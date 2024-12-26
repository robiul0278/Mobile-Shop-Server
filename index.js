const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId, } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 4000;

// middleware
app.use(cors({
  origin: [process.env.FRONTEND_URL, process.env.FRONTEND_LOCAL_URL],
  optionsSuccessStatus: 200,
}));


app.use(express.json());

// token verification
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.send({ message: "No Token" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.send({ message: "Invalid Token" });
    }
    req.decoded = decoded;
    next();
  });
};



// mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.djxbtyf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function main() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");

    // Define a database and collection
    const userCollection = client.db("gadgetShop").collection("users");
    const productCollection = client.db("gadgetShop").collection("products");

    // jsonwebtoken
    app.post("/jsonwebtoken", async (req, res) => {
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.JWT_SECRET_TOKEN, { expiresIn: "10d" });
      res.send({ token });
    });

    // verify seller
    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "seller") {
        return res.send({ message: "Forbidden access" });
      }
      next();
    };

    // Get All User
    app.get("/user", verifyJWT, async (req, res) => {
      const user = await userCollection.find()
        .toArray()
      res.send(user)
    })

    // Insert Register User 
    app.post("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exist!" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // Get Single User 
    app.get("/user/:email", async (req, res) => {
      const query = { email: req.params.email };
      const user = await userCollection.findOne(query);
      if (!user) {
        return res.send({ message: "No user found !" })
      }
      res.send(user);
    })


    // Delete User
    app.delete("/user/:id", async (req, res) => {
      const { id } = req.params;

      const result = await userCollection.deleteOne({ _id: new ObjectId(id) });

  res.send(result);
    });

    // Change Role By admin
    // app.patch("/user/:id", verifyJWT, async (req, res) => {
    //   const id= req.params;
    //   const role= req.body;
    //   const updatedUser = await userCollection.updateOne(
    //     { _id: new ObjectId(id) },
    //     { $set: role},
    //   );
    //   res.send(updatedUser);
    // });

    app.patch("/user/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id; // Extract the ID from params
        const { role } = req.body; // Extract the role from the body
    
        // Validate the role
        const validRoles = ["admin", "buyer", "seller"];
        if (!validRoles.includes(role)) {
          return res.status(400).send({ message: "Invalid role specified." });
        }
    
        // Update the user's role
        const updatedUser = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );
        res.send(updatedUser);
      } catch (error) {
        console.error("Error updating role:", error);
        res.status(500).send({ message: "An error occurred while updating the role." });
      }
     
    });

    // add Product 
    app.post("/add-product", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });

    // Get All Product 
    app.get("/all-product", async (req, res) => {
      try {
        // Destructure query parameters
        const { title, sort, category, brand, page = 1, limit = 9 } = req.query;

        // Build the query object
        const query = {};
        if (title) {
          query.title = { $regex: title, $options: "i" }; // Case-insensitive regex
        }
        if (category) {
          query.category = { $regex: category, $options: "i" }; // Case-insensitive regex
        }
        if (brand) {
          query.brand = brand;
        }

        // pagination
        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        // Determine sort options
        const sortOptions = sort === "asc" ? 1 : -1;

        // Fetch products based on query and sort
        const products = await productCollection
          .find(query)
          .skip((pageNumber - 1) * limitNumber)
          .limit(limitNumber)
          .sort({ price: sortOptions }) // Apply sort only if specified
          .toArray();

        // Get the total count of matching products
        const totalProducts = await productCollection.countDocuments(query);

        // Fetch all categories and brands for filtering options
        // const productInfo = await productCollection
        //   .find({}, { projection: { category: 1, brand: 1 } })
        //   .toArray();

        // Deduplicate categories and brands
        const brands = [...new Set(products.map((product) => product.brand))];
        const categories = [...new Set(products.map((product) => product.category))];

        // Send the response
        res.json({ products, brands, categories, totalProducts });
      } catch (error) {
        // Error handling
        console.error(error);
        res.status(500).json({ error: "An error occurred while fetching products." });
      }
    });


    //Get single Products 
    app.get("/all-product/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const data = await productCollection.findOne(query); // Single data
      res.send(data);
    });


    //  My All Products  =========== 
    app.get("/manage-products/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      try {
        // Find the user based on the email
        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).send({ message: "User not found!" });
        }
        // Find all products associated with this email
        const products = await productCollection.find({ email }).toArray();
        // console.log("products",products)
        res.send(products);
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send({ message: "Server error occurred!" });
      }
    });


    // Delete Seller Product 
    app.delete("/delete-product/:productId", async (req, res) => {
      const productId = req.params.productId;

      try {
        // Convert productId to ObjectId (if you're using MongoDB's ObjectId)
        const objectId = new ObjectId(productId);

        // Delete the product with the given productId
        const result = await productCollection.deleteOne({ _id: objectId });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Product not found!" });
        }
        res.send({ message: "Product deleted successfully!" });
      } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).send({ message: "Server error occurred!" });
      }
    });

    // Update Product by Seller 
    app.put("/update-product/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;  // You already have `id` from the route params
      const productData = req.body; // The data to update
      // console.log(id, productData);
      try {
        // Convert the product ID to ObjectId
        const objectId = new ObjectId(id); // Use the `id` from the route
        // Update the product in the database
        const result = await productCollection.updateOne(
          { _id: objectId }, // Match the document by ID
          { $set: productData } // Update only the fields provided in productData
        );
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Product not found!" });
        }
        res.send({ message: "Product updated successfully!", result });
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).send({ message: "Server error occurred!" });
      }
    });


    // add to wishlist 
    app.patch("/add-wishlist", verifyJWT, async (req, res,) => {
      const { userEmail, productId } = req.body;

      const result = await userCollection.updateOne(
        { email: userEmail },
        { $addToSet: { wishlist: new ObjectId(String(productId)) } }
      )
      res.send(result);
    })

    // remove to wishlist 
    app.patch("/remove-wishlist", async (req, res,) => {
      const { userEmail, productId } = req.body;
      // console.log("Remove", userEmail, productId);
      const result = await userCollection.updateOne(
        { email: userEmail },
        { $pull: { wishlist: new ObjectId(String(productId)) } }
      )
      res.send(result);
    })

    // get wishlist data 
    app.get("/wishlist/:userId", verifyJWT, async (req, res) => {
      const userId = req.params.userId;
      // console.log(userId);
      const user = await userCollection.findOne(
        {
          _id: new ObjectId(userId),
        }
      )
      if (!user) {
        return res.send({ message: "User not Found!" })
      }
      const wishlist = await productCollection.find(
        {
          _id: { $in: user.wishlist || [] }
        }
      ).toArray();
      res.send(wishlist);
    })

    // add to cart 
    app.patch("/add-cart", verifyJWT, async (req, res,) => {
      const { userEmail, productId } = req.body;

      const result = await userCollection.updateOne(
        { email: userEmail },
        { $addToSet: { cart: new ObjectId(String(productId)) } }
      )
      res.send(result);
    });

    // remove product to cart
    app.patch("/remove-cart", async (req, res,) => {
      const { userEmail, productId } = req.body;

      const result = await userCollection.updateOne(
        { email: userEmail },
        { $pull: { cart: new ObjectId(String(productId)) } }
      )
      res.send(result);
    })

    // get data from cart 
    app.get("/cart/:userId", verifyJWT, async (req, res) => {
      const userId = req.params.userId;
      // console.log(userId);
      const user = await userCollection.findOne(
        {
          _id: new ObjectId(userId),
        }
      )
      if (!user) {
        return res.send({ message: "User not Found!" })
      }
      const cart = await productCollection.find(
        {
          _id: { $in: user.cart || [] }
        }
      ).toArray();

      res.send(cart);
    })


    //Server api
    app.get("/", (req, res) => {
      res.send("Server is running...!");
    });

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });


  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
  }
}
main();
