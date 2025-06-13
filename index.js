require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-adminsdk.json");

// Middleware
app.use(cors());
app.use(express.json());

// Mongo Connection
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.lds4lih.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(403).send({ error: "Forbidden access" });
  }
};

const verifyTokenEmail = async (req, res, next) => {
  if (req.quer.email !== req.decoded.email) {
    return res.status(403).send({ error: "Forbidden access" });
  }
  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const careerCollection = client.db("careerDb").collection("career");
    const applicationCollection = client
      .db("careerDb")
      .collection("applications");

    // Jobs api
    // GET
    app.get("/careers", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.hr_email = email;
      }
      const result = await careerCollection.find(query).toArray();
      res.send(result);
    });

    // Specific GET
    app.get("/careers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await careerCollection.findOne(query);
      res.send(result);
    });

    // POST
    app.post("/careers", async (req, res) => {
      const newJob = req.body;
      const result = await careerCollection.insertOne(newJob);
      res.send(result);
    });

    // Job application related api's

    //GET
    app.get("/applications", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;

      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ error: "Forbidden access" });
      // }

      if (email !== req.decoded.email) {
        return res.status(403).send({ error: "Forbidden access" });
      }

      const query = { applicant: email };
      const result = await applicationCollection.find(query).toArray();

      // Bad way to aggregate data
      for (const application of result) {
        const id = application.id;
        const jobQuery = { _id: new ObjectId(id) };
        const job = await careerCollection.findOne(jobQuery);
        application.company = job.company;
        application.title = job.title;
        application.company_logo = job.company_logo;
      }

      res.send(result);
    });

    app.get("/applications/job/:id", async (req, res) => {
      const jobId = req.params.id;
      const query = { id: jobId };
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    });

    // POST
    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationCollection.insertOne(application);
      res.send(result);
    });

    // PATCH
    app.patch("/application/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: req.body.status,
        },
      };
      const result = await applicationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Career Code Server Running!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
