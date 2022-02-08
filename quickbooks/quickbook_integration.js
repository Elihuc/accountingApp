const mongoose = require('mongoose');
const Account = require('../models/account');
const Quickbooks = require('node-quickbooks');
const OAuthClient = require('intuit-oauth');
const QuickbooksToken = require('../models/quickbooksToken');
const qbconfig = require('../quickbooks/config.json');

const QB_CLIENT_ID = qbconfig.client_id;
const QB_CLIENT_SECRET = qbconfig.client_secret;
const QB_ENV = qbconfig.environment;
const QB_REDIRECT = qbconfig.redirect_uri;

const getFreshToken = async (associateId) => {
    const token = await QuickbooksToken.findOne({ associateId: associateId });
    if (!token) {
        return null;
    } else {

        let oauthClient = new OAuthClient({
            clientId: QB_CLIENT_ID,
            clientSecret: QB_CLIENT_SECRET,
            environment: QB_ENV,
            redirectUri: QB_REDIRECT,
            token: JSON.parse(token.tokenStringifyJsonObject)
        });
        oauthClient = await oauthClient.refresh();
        const freshToken = oauthClient.token.getToken();
        if (freshToken) {
            token.access_token = freshToken.access_token;
            token.refresh_token = freshToken.refresh_token;
            token.tokenStringifyJsonObject = JSON.stringify(freshToken);
            return token.save();
        }
    }
}
const getQuickbookInstance = async (associateId) => {
    const tokenData = await getFreshToken(associateId);
    if (tokenData) {
        return new Quickbooks(
            QB_CLIENT_ID,
            QB_CLIENT_SECRET,
            tokenData.access_token,
            false,
            tokenData.realmId,
            true,
            false,
            null,
            "2.0",
            tokenData.refreshToken
        )
    } else {
        return null;
    }
}
const createNewCustomer = async (associateId, firstName, lastName, email) => {

    const qb = await getQuickbookInstance(associateId);
    if (!qb) {
        return null;
    }
    return new Promise(function (resolve, reject) {
        qb.createCustomer(
            {
                CurrencyRef: { value: "USD", name: "United States Dollar" },
                domain: "QBO",
                GivenName: firstName,
                FamilyName: lastName,
                Active: true,
                PrimaryEmailAddr: { Address: email },
            },
            function (err, customer) {
                if (err) {
                    reject(err);
                }
                if (customer) {
                    resolve(customer);
                }
            }
        )
    })

}
const findCustomers = async (associateId) => {
    const qb = await getQuickbookInstance(associateId);
    if (!qb) {
        return null;
    }
    return new Promise(function (resolve, reject) {
        qb.findCustomers(function (err, customers) {
            if (err) {
                reject(err);
            }
            if (customers.QueryResponse.Customer) {
                resolve(customers.QueryResponse.Customer);
            }
        })
    })
}
const checkIfCustomerExist = async(associateId, firstName, lastName) => {
    const qb = await getQuickbookInstance(associateId);
    if (!qb) {
        return null
    }

    return new Promise(function(resolve, reject){
        qb.findCustomers({
            GivenName: firstName,
            FamilyName: lastName
        }, function(err, result){
            if(err){
                reject(err);
            }
            if(result.QueryResponse){
                if(result.QueryResponse.Customer){
                    resolve(result.QueryResponse.Customer[0])
                } else {
                    resolve(null);
                }
            }
        })
    })

}
const getCustomerRef = async (associateId, firstName, lastName) => {
    const qb = await getQuickbookInstance(associateId);
    if (!qb) {
        return null
    }

    const customer = await checkIfCustomerExist(associateId, firstName, lastName)
    .catch((err) => console.log("An error occured", err));

    console.log(`customer: ${customer}`);

    const customerRef = {};
    if (customer) {
        console.log('found');
        customerRef.value = customer.Id;
        customerRef.name = customer.DisplayName;
    } else {
        console.log('not found');
        const newCustomer = await createNewCustomer(associateId, 'First', 'Last', email);
        if (newCustomer) {
            customerRef.value = newCustomer.Id;
            customerRef.name = newCustomer.DisplayName;
        }
    }
    return customerRef;
}
const createNewInvoice = async (
    associateId,
    firstName,
    lastName,
    amountToCharge,
    description,
    dueDate
) => {
    console.log('1');
    const qb = await getQuickbookInstance(associateId);
    if (!qb) {
        return null
    }

    //Get customer ref by email
    const customerRef = await getCustomerRef(associateId, firstName, lastName);
    console.log(`customerRef: ${JSON.stringify(customerRef)}`);
    //Create new invoice
    const invoiceDetails = {
        domain: "QBO",
        CurrencyRef: { value: "USD", name: "United States Dollar" },
        Line: [
            {
                Description: description,
                Amount: amountToCharge,
                DetailType: "SalesItemLineDetail",
                SalesItemLineDetail: {
                    UnitPrice: amountToCharge,
                    Qty: 1,
                    TaxCodeRef: { value: "TAX" }
                }
            }
        ],
        CustomerRef: customerRef,
        DueDate: new Date(dueDate)
    }


    return new Promise(function (resolve, reject){
        qb.createInvoice(invoiceDetails, function(err, invoice){
            if(err){
                reject(err);
            }
            if(invoice){
                resolve(invoice);
            }
        })
    })

}
const createPayment = async (
    associateId,
    firstName,
    lastName,
    amount
) => {
    const qb = await getQuickbookInstance(associateId);
    if (!qb) {
        return null
    }
    const customerRef = await getCustomerRef(associateId, firstName, lastName);
    const paymentDetails = {
        TotalAmt: amount,
        CustomerRef: { name: customerRef.name, value: customerRef.value },
        CurrencyRef: { value: "USD", name: "United States Dollar" }
    }

    return new Promise(function(resolve, reject){
        qb.createPayment(paymentDetails, function(err, payment){
            if(err){
                reject(err);
            }
            if(payment){
                resolve(payment);
            }
        })
    })

}

const findPaymentMethod = async (associateId) => {
    const qb = await getQuickbookInstance(associateId);
    if(!qb){
        return null;
    }
    return new Promise(function(resolve, reject){
        qb.findPaymentMethods(function(err, paymentsMethod){
            if(err){
                reject(err);
            }
            if(paymentsMethod.QueryResponse.PaymentMethod){
                console.log(paymentsMethod.QueryResponse.PaymentMethod);
                resolve(paymentsMethod.QueryResponse.PaymentMethod);
            }
        })
    })
}



const findInvoices = async (associateId) => {
    const qb = await getQuickbookInstance(associateId);
    if(!qb){
        return null;
    }
    return new Promise(function(resolve, reject){
        qb.findInvoices(function(err, invoices){
            if(err){
                reject(err);
            }
            if(invoices.QueryResponse.Invoice){
                resolve(invoices.QueryResponse.Invoice);
            }
        })
    })
}



const findPayments = async (associateId) => {
    const qb = await getQuickbookInstance(associateId);
    if(!qb){
        return null;
    }
    return new Promise(function(resolve, reject){
        qb.findPayments(function(err, payments){
            if(err){
                reject(err);
            }
            if(payments.QueryResponse.Payment){
                resolve(payments.QueryResponse.Payment);
            }
        })
    })
}


const findBills = async (associateId) => {
    const qb = await getQuickbookInstance(associateId);
    if(!qb){
        return null;
    }
    return new Promise(function(resolve, reject){
        qb.findBills(function(err, bills){
            if(err){
                reject(err);
            }
            if(bills.QueryResponse.Bill){
                resolve(bills.QueryResponse.Bill);
            }
        })
    })
}


exports.getQuickbookInstance = getQuickbookInstance;
exports.createNewCustomer = createNewCustomer;
exports.findCustomers = findCustomers;
exports.createNewInvoice = createNewInvoice;
exports.createPayment = createPayment;
exports.findPaymentMethod = findPaymentMethod;
exports.findInvoices = findInvoices;
exports.findPayments = findPayments;
exports.findBills = findBills;