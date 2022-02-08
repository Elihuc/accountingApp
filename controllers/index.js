const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Account = require('../models/account');
const stripe = require('stripe')('sk_test_51JLnkWJneDpO7a8x2oC7KpweKVMhqAWKjbuoA9QT0PwUhbHGFxwG3dgDHWoeiZ2vNGWgYQsjyRO5OhMXnyl2ENw5007rqvXrku');
const QuickbooksToken = require('../models/quickbooksToken');
const quickbooks_integration = require('../quickbooks/quickbook_integration');

//ADD NEW CUSTOMER
router.post('/addCustomer', async (request, response) => {

    const firstName = request.body.firstName;
    const lastName = request.body.lastName;
    const email = request.body.email;
    const id = mongoose.Types.ObjectId();

    const _account = new Account({
        _id: id,
        firstName: firstName,
        lastName: lastName,
        email: email,
        mobile: '',
        isConfirm: true,
        isLocked: false
    });
    _account.save()
        .then(account_created => {
            return response.status(200).json({
                status: true,
                msg: account_created
            });
        })
        .catch(error => {
            return response.status(500).json({
                status: false,
                msg: error.message
            });
        })
})
//GET ALL CUSTOMERS
router.get('/getCustomers', async (request, response) => {
    Account.find()
        .then(customers => {
            return response.status(200).json({
                status: true,
                msg: customers
            });
        })
        .catch(err => {
            return response.status(500).json({
                status: false,
                msg: err.message
            });
        })
})
//UPDATE ACCOUNT WITH STRIPE CUSTOMER
router.get('/updateAccountWithStripe/:accid', async (request, response) => {
    const accid = request.params.accid;
    const account = await Account.findById(accid);
    if (account) {
        const stripeAccount = await stripe.customers.create({
            email: account.email,
            name: `${account.firstName} ${account.lastName}`
        });

        account.customer = stripeAccount.id;
        account.save()
            .then(account_updated => {
                return response.status(200).json({
                    status: true,
                    msg: account_updated
                });
            })
            .catch(err => {
                return response.status(500).json({
                    status: false,
                    msg: err.message
                });
            })
    }
})
//CREATE AND SAVE CREDIT CARD AS STRIPE SOURCE
router.post('/createStripeSource/:accid', async (request, response) => {

    const accid = request.params.accid;

    //Get source data
    const card_exp_month = request.body.card_exp_month;
    const card_exp_year = request.body.card_exp_year;
    const card_holder = request.body.card_holder;
    const card_cvc = request.body.card_cvc;
    const card_number = request.body.card_number;

    //Create stripe token
    stripe.tokens.create({
        card: {
            number: card_number,
            exp_month: card_exp_month,
            exp_year: card_exp_year,
            cvc: card_cvc,
            name: card_holder
        }
    }).then(async token => {
        const account = await Account.findById(accid);
        const createStripeSource = await stripe.customers.createSource(
            account.customer, { source: token.id }
        )
        return response.status(200).json({
            status: true,
            msg: createStripeSource
        })
    })
        .catch(err => {
            console.log(err.message);
        })


})

//GET CUSTOMER SOURCES LIST
router.get('/getStripeSOurceList/:accid', async(request, response) => {
    const accid = request.params.accid;
    const account = await Account.findById(accid);
    const sources = await stripe.customers.listSources(
        account.customer, { object: 'card', limit: 4 }
    )
    return response.status(200).json({
        status: true,
        sources: sources
    });
})
//SET DEFAULT SOURCE
router.post('/setDefaultSource/:accid', async(request, response) => {
    const accid = request.params.accid;
    const account = await Account.findById(accid);
    const sourceId = request.body.sourceId;

    try {
        const defaultSource = await stripe.customers.update(
            account.customer, { default_source: sourceId }
        )
        return response.status(200).json({
            status: true,
            msg: defaultSource
        });
    } catch (error) {
        return response.status(500).json({
            status: true,
            msg: error.message
        });
    }

})

//REMOVE SOURCE
router.get('/deleteStripeSource/:accid/:sourceId', async(request, response) => {
    const account = await Account.findById(request.params.accid);
    const deleteSource = await stripe.customers.deleteSource(
        account.customer, request.params.sourceId
    )
    return response.status(200).json({
        status: true,
        msg: deleteSource
    });
})

//CREATE PAYMENT
router.post('/createStripePayment/:accid', async(request, response) => {
    const accid = request.params.accid;
    const account = await Account.findById(accid);
    const amount = request.body.amount;
    const stripeAmount = amount * 100;

    stripe.charges.create({
        amount: stripeAmount,
        currency: 'usd',
        customer: account.customer
    })
    .then(async transaction => {
        if(transaction.status === 'succeeded'){

            const createPayment = await quickbooks_integration.createPayment(
                '6117d1b5ffb24b2ed3608b6d',
                'Eyal',
                'Chitrit',
                370
            );


            return response.status(200).json({
                status: true,
                msg: transaction
            });
        } else {
            return response.status(200).json({
                status: false,
                msg: 'Transaction failed'
            });
        }
    })
    .catch(error => {
        return response.status(500).json({
            status: false,
            msg: error.message
        });
    })
})

router.get('/welcome', async (request, response) => {
    const bills = await quickbooks_integration.findBills('6117d1b5ffb24b2ed3608b6d');
    return response.status(200).json({
        status: true,
        data: bills
    });
})

//QUICKBOOKS INTEGRATION

//Create one time model token
router.post('/createQBToken', async(request,response) => {
    const realmId = request.body.realmId;
    const access_token = request.body.access_token;
    const refresh_token = request.body.refresh_token;
    const client_id = request.body.client_id;
    const client_secret = request.body.client_secret;
    const associateId = request.body.associateId;
    const id = mongoose.Types.ObjectId();

    const _quickbooksToken = new QuickbooksToken({
        _id: id,
        realmId: realmId,
        access_token: access_token,
        refresh_token: refresh_token,
        client_id: client_id,
        client_secret: client_secret,
        associateId: associateId,
        tokenStringifyJsonObject: ''
    });
    _quickbooksToken.save()
    .then(qbtoken => {
        return response.status(200).json({
            status: true,
            data: qbtoken
        });
    })
    .catch(error => {
        return response.status(500).json({
            status: false,
            data: error
        });
    })
})

router.post('/createNewCustomer/:associateId', async(request, response) => {
    const associateId = request.params.associateId;
    const firstName = request.body.firstName;
    const lastName = request.body.lastName;
    const email = request.body.email;
    await quickbooks_integration.createNewCustomer(associateId,firstName,lastName,email)
    .then(customer => {
        return response.status(200).json({
            status: true,
            data: customer
        })
    })
    .catch(error => {
        return response.status(500).json({
            status: false,
            data: error
        })
    })
})

router.get('/getQBCustomers/:associateId', async(request, response) => {
    const associateId = request.params.associateId;
    await quickbooks_integration.findCustomers(associateId)
    .then(customers => {
        return response.status(200).json({
            status: true,
            data: customers
        })
    })
    .catch(error => {
        return response.status(500).json({
            status: false,
            data: error
        })
    })
})


router.post('/createNewInvoice/:associateId', async(request, response) => {
    const associateId = request.params.associateId;
    const firstName = request.body.firstName;
    const lastName = request.body.lastName;
    const amountToCharge = request.body.amountToCharge;
    const description = request.body.description;
    const dueDate = request.body.dueDate;

    await quickbooks_integration.createNewInvoice(associateId,firstName,lastName,amountToCharge,description,dueDate)
    .then(invoice => {
        return response.status(200).json({
            status: true,
            data: invoice
        })
    })
    .catch(error => {
        return response.status(500).json({
            status: false,
            data: error
        })
    })
})


router.get('/callback', async(request, response) => {
    //TO DO
})

module.exports = router;