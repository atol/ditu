const express = require('express')
const router = express.Router()
const db = require('../models/db')
const pool = db.pool
const bcrypt = require('bcryptjs')
const Joi = require('joi') // this library helps with checking user input info validity

const signUpSchema = Joi.object().keys({
    name: Joi.string().required(),
    email: Joi.string().email({ minDomainAtoms: 2 }).required(),
    password: Joi.string().min(8).required(), //add uppercase etc reqs later, for now min passlength=8
})

const loginSchema = Joi.object().keys({
    email: Joi.string().email({ minDomainAtoms: 2 }).required(),
    password: Joi.string().min(8).required(), //add uppercase etc reqs later, for now min passlength=8
})

router.get('/', function (req, res) {
    var user = req.session.user_id;
    res.render('pages/index', { logged_in: user });
});

router.get('/login', (req, res) => {
    res.redirect('/login.html')
})

router.get('/signup', (req, res) => {
    res.redirect('/signup.html')
})

router.get('/logout', function (req, res) {
    req.session.destroy();
    res.redirect('/logout.html');
});

router.post('/signup', async (req, res) => {
    const result = Joi.validate(req.body, signUpSchema)
    if (result.error === null) {
        //check for duplicate username else it's good and add to db
        try {
            let accessLevel = 0; //basic user
            const name = req.body.name
            const emailInput = req.body.email
            let email = new String(emailInput)
            email = email.toLowerCase() // ensures all emails stored are stored as lowercase emails
            const hashedPassword = await bcrypt.hash(req.body.password, 10)
            const client = await pool.connect();
            const qResult = await client.query(`SELECT * FROM users WHERE email=$1`, [email])
            if (qResult.rows && qResult.rows.length > 0) {
                res.render('pages/auth/signup', { message: "This user already exists in the system. Please login." })
            }
            else {
                try {
                    await client.query(`INSERT INTO users (name, email, password, accesslevel) VALUES ($1, $2, $3, $4)`, [name, email, hashedPassword, accessLevel])
                    res.render('pages/auth/signup', { message: "Your user has been created! Please login." })
                } catch (err) {
                    console.error(err)
                    res.render('pages/error', { message: err })
                }
            }
            client.release()
        } catch (err) {
            console.error(err)
            res.render('pages/error', { message: err })
        }
    }
    else {
        res.render('pages/auth/login', { message: "Please provide complete information. Your password should be at least 8 characters, and you should supply a valid email and name." })
    }
})

router.post('/login', async (req, res) => {
    const result = Joi.validate(req.body, loginSchema)
    //Checking if valid info inputted
    if (result.error === null) {
        //check if username is found in db
        try {
            let email = new String(req.body.email)
            email = email.toLowerCase() // ensures all emails stored are stored as lowercase emails
            const client = await pool.connect();
            const qResult = await client.query(`SELECT * FROM users WHERE email=$1`, [email])
            if (qResult.rows && qResult.rows.length > 0) { //if email found in db
                try {
                    if (await bcrypt.compare(req.body.password, qResult.rows[0].password)) {
                        var access = qResult.rows[0].accesslevel;
                        req.session.user_name = qResult.rows[0].name;
                        req.session.user_id = qResult.rows[0].id;
                        req.session.user_access = access;
                        res.redirect('/dashboard');
                    } else {
                        res.render('pages/auth/login', { message: "Sorry, your email or password was incorrect. Please double-check your email or password." })
                    }
                } catch (err) {
                    console.error(err)
                    res.render('pages/error', { message: err })
                }
            }
            else { // if email not found in db
                res.render('pages/auth/login', { message: "Sorry, your email or password was incorrect. Please double-check your email or password." })
            }
            client.release()
        } catch (err) {
            console.error(err)
            res.render('pages/error', { message: err })
        }
    }
    else {
        res.render('pages/auth/login', { message: "Please provide a valid email and password." })
    }
})

module.exports = router;