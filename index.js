const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iulixph.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const allUsersCollection = client.db("RealStateDb").collection("allUsers");
    const propertiesCollection = client.db("RealStateDb").collection("properties");
    const wishlistCollection = client.db("RealStateDb").collection("wishlist");
    const reviewsCollection = client.db("RealStateDb").collection("reviews");
    const reportsCollection = client.db("RealStateDb").collection("reports");
    const paymentsCollection = client.db("RealStateDb").collection("payments");
    const boughtPropertyCollection = client.db("RealStateDb").collection("boughtProperty");
    const offeredPropertyCollection = client.db("RealStateDb").collection("offeredProperty");

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'Admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }


    app.get('/properties', async (req, res) => {
      const result = await propertiesCollection.find().toArray()
      res.send(result)
    })

    app.get('/agent-properties', async (req, res) => {
      const email = req.query.email;
      const query = {
        agentEmail: email
      }
      const result = await propertiesCollection.find(query).toArray()
      res.send(result)
    })

    // get user by email
    app.get('/logged-user-role', async (req, res) => {
      const email = req.query.email;
      console.log('logged user', email);
      const query = {
        email: email
      }
      const result = await allUsersCollection.findOne(query)
      console.log(result);
      res.send(result);
    })

    // all offered properties
    app.get('/offered-properties', async (req, res) => {
      const result = await offeredPropertyCollection.find().toArray()
      res.send(result)
    })


    // 


    app.get('/verified-properties', async (req, res) => {
      const status = req.query.status;
      const page = parseInt(req.query.page) - 1;
      const size = parseInt(req.query.size);
      const search = req.query.search;
      const maxPrice = parseInt(req.query.maxPrice);
      const minPrice = parseInt(req.query.minPrice);
      console.log(maxPrice, minPrice);
      let query = {
        status: status
      };
      if (search) query = {
        location: { $regex: search, $options: 'i' },
        status: status
      }

      if (maxPrice > 0 && minPrice > 0) {
        query = {

          minimumPrice: { $gte: minPrice },
          maximumPrice: { $lte: maxPrice }
        }
      }
      const result = await propertiesCollection.find(query).skip(page * size).limit(size).toArray();
      console.log('result');
      res.send(result)
    })

    // Get  count 
    app.get('/count-properties', async (req, res) => {
      const status = req.query.status;
      const search = req.query.search
      const maxPrice = parseInt(req.query.maxPrice);
      const minPrice = parseInt(req.query.minPrice);

      let query = {
        status: status
      };
      if (search) query = {
        location: { $regex: search, $options: 'i' },
        status: status
      }
      if (maxPrice > 0 && minPrice > 0) {
        query = {

          minimumPrice: { $gte: minPrice },
          maximumPrice: { $lte: maxPrice }
        }
      }

      const count = await propertiesCollection.countDocuments(query)
      console.log('count', count);
      res.send({ count })
    })



    app.get('/property/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await propertiesCollection.findOne(query)
      res.send(result)
    })

    //  get wishlist single data by id for make offer
    app.get('/wishlist/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await wishlistCollection.findOne(query)
      res.send(result)
    })

    app.post('/add-property', async (req, res) => {
      const property = req.body;
      const result = await propertiesCollection.insertOne(property)
      res.send(result)
    })


    app.post('/offered-property', async (req, res) => {
      const propertyData = req.body;
      const query = {
        propertyId: propertyData?.propertyId,
        buyerEmail: propertyData?.buyerEmail
      }
      const property = await offeredPropertyCollection.findOne(query);

      if (property) {
        return res.send({ message: 'You have already offered a price of this property' })
      }
      const result = await offeredPropertyCollection.insertOne(propertyData)
      res.send(result)
    })


    // get wishlist data by query
    app.get('/wishlist', async (req, res) => {
      const email = req.query.email;
      const query = {
        buyerEmail: email
      }
      const result = await wishlistCollection.find(query).toArray();
      res.send(result)
    })

    // get review data by query
    app.get('/reviews', async (req, res) => {
      const email = req.query.email;
      const query = {
        email: email
      }
      const result = await reviewsCollection.find(query).toArray();
      res.send(result)
    })

    // get bought property data by query
    app.get('/offered-property', async (req, res) => {
      const email = req.query.email;
      const query = {
        buyerEmail: email
      }
      const result = await offeredPropertyCollection.find(query).toArray();
      res.send(result)
    })




    // add to wishlist
    app.post('/wishlist-property', async (req, res) => {
      const propertyData = req.body;
      console.log("main", propertyData.buyerEmail);
      const query = {
        propertyId: propertyData?.propertyId,
        buyerEmail: propertyData?.buyerEmail
      }

      const property = await wishlistCollection.findOne(query);
      console.log(property);

      if (property) {
        return res.send({ message: 'Property already added to your wishlist' })
      }

      const result = await wishlistCollection.insertOne(propertyData);
      res.send(result)


    })

    // get reviews by property
    app.get('/reviews/:id', async (req, res) => {
      const id = req.params.id;

      const query = {

        propertyId: id
      }
      const result = await reviewsCollection.find(query).sort({ date: -1 }).toArray();
      res.send(result)
    })


    // add  reviews
    app.post('/add-review', async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review)
      res.send(result)
    })


    // add  report
    app.post('/add-report', async (req, res) => {
      const report = req.body;
      const result = await reportsCollection.insertOne(report)
      res.send(result)
    })


    // update a property in db
    app.put('/property/:id', async (req, res) => {
      const id = req.params.id
      const jobData = req.body
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...jobData,
        },
      }
      const result = await propertiesCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })



    // get all users
    app.get('/users', async (req, res) => {
      console.log('all-user');
      const result = await allUsersCollection.find().toArray();
      res.send(result)
    })



    // save user in userCollection
    app.post('/users', async (req, res) => {
      const userInfo = req.body;
      const query = {
        email: userInfo?.email
      }
      const user = await allUsersCollection.findOne(query);
      if (user) {
        return res.send({ message: 'User already created' })
      }
      const result = await allUsersCollection.insertOne(userInfo);
      res.send(result)
    })




    //  Change User Role
    app.patch('/users/role', async (req, res) => {
      const user = req.body;
      const id = user?.id;
      const role = user?.role
      const email = user?.email
      console.log('gmail', email, id, role);
      const filter = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          role: role
        }
      }
      const result = await allUsersCollection.updateOne(filter, updatedDoc);

      if (role === 'Fraud') {
        const query = {
          agentEmail: email
        }
        console.log(query);
        const deleteResult = await propertiesCollection.deleteMany(query);
        console.log(deleteResult);
      }

      res.send({ message: 'Role updated successfully' });
    })

    // Change Property Status
    app.patch('/property/status/:id', async (req, res) => {
      const propertyStatus = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: propertyStatus?.status
        }
      }

      const result = await propertiesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })





    app.patch('/offered-property-action', async (req, res) => {
      const properties = req.body;
      const id = properties.id;
      const status = properties.status;
      const email = properties.buyerEmail;
      const propertyId = properties.propertyId;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { status: "Accepted" } };
      const result = await offeredPropertyCollection.updateOne(filter, updatedDoc);
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: 'Property not found or buyer email mismatch' });
      }

      const filter1 = {
        propertyId: propertyId,
        _id: { $ne: new ObjectId(id) },
      };
      const updateDoc1 = { $set: { status: 'Rejected' } };
      const updateManyResult = await offeredPropertyCollection.updateMany(filter1, updateDoc1);
      console.log(updateManyResult);
      res.send({ message: 'Property status updated successfully' });
    });


    app.patch('/offer-reject', async (req, res) => {

      const statusData = req.body;
      const id = statusData.id;
      const status = statusData.status
      console.log(id);
      const filter = {
        _id: new ObjectId(id)
      }
      const updatedDoc = { $set: { status: status } };
      const result = await offeredPropertyCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })



    // offered and accepted property 
    app.get('/payment-property/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await offeredPropertyCollection.findOne(query)
      res.send(result)
    })

    // all reviews get
    app.get('/all-reviews', async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result)
    })
    //get all Reports
    app.get('/all-reports', async (req, res) => {
      const result = await reportsCollection.find().toArray();
      res.send(result)
    })

    // Advertise property 
    app.patch('/advertise-property', async (req, res) => {
      const property = req.body;
      console.log('advertise', property);
      const filter = {
        _id: new ObjectId(property?.id)
      }
      const updatedDoc = {
        $set: {
          advertise: property?.advertise
        }
      }
      const result = await propertiesCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    // sold and paid property 
    app.get('/sold-properties', async (req, res) => {
      const email = req.query.email;
      const query = {
        agentEmail: email
      }
      const result = await paymentsCollection.find(query).toArray()
      res.send(result)
    })

    // delete user
    app.delete('/user/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await allUsersCollection.deleteOne(query)
      res.send(result)
    })

    // delete property
    app.delete('/property/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await propertiesCollection.deleteOne(query)
      res.send(result)
    })
    // remove from wishlist
    app.delete('/wishlist/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await wishlistCollection.deleteOne(query)
      res.send(result)
    })

    // Delete reported-property
    app.patch('/reported-property', async (req, res) => {
      const ids = req.body;
      const propertyId = ids.propertyId;
      const id = ids.id;

      const query = {
        _id: new ObjectId(propertyId)
      }
      const result = await propertiesCollection.deleteOne(query)
      const query1 = {
        propertyId: propertyId
      }
      const result1 = await reviewsCollection.deleteMany(query1);
      const filter = {
        _id: new ObjectId(id)
      }
      const updatedDoc = {
        $set: {
          status: "Removed"
        }
      }
      const result2 = await reportsCollection.updateOne(filter, updatedDoc);
      res.send({ message: 'Property Removed Successfully' })
    })


    // Delete review
    app.delete('/review/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await reviewsCollection.deleteOne(query)
      res.send(result)
    })



    // app.get('/payments/:email',  async (req, res) => {
    //   const query = { email: req.params.email }
    //   if (req.params.email !== req.decoded.email) {
    //     return res.status(403).send({ message: 'forbidden access' });
    //   }
    //   const result = await paymentCollection.find(query).toArray();
    //   res.send(result);
    // })

    app.post('/payments', async (req, res) => {
      const payment = req.body;

      const paymentResult = await paymentsCollection.insertOne(payment);
      console.log(payment.boughtId);
      console.log('transactionId', payment.transactionId);
      //  carefully delete each item from the cart
      console.log('payment info', payment);
      const filter = {
        _id: new ObjectId(payment.boughtId)
      };

      const updatedDoc = {
        $set: {
          status: 'Bought',
          transactionId: payment.transactionId
        }
      }

      const updateResult = await offeredPropertyCollection.updateOne(filter, updatedDoc);

      res.send({ paymentResult, updateResult });
    })




    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      console.log('create-payment-intent');
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      console.log(paymentIntent);
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Real state server is running')
})

app.listen(port, () => {
  console.log(`Real state server is running on port ${port}`);
})