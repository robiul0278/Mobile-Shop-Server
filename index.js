const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId, } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;


app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5175'],
  })
);

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
    const purchaseCollection = client.db("gadgetShop").collection("order");
    const flashSaleCollection = client.db("gadgetShop").collection("flash-sale");

    // jsonwebtoken
    app.post("/jsonwebtoken", async (req, res) => {
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.JWT_SECRET_TOKEN, { expiresIn: "10d" });
      res.send({ token });
    });


    // verify seller
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
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
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);

        if (existingUser) {
          return res.status(409).json({ message: "User already exists!" });
        }

        const result = await userCollection.insertOne(user);
        res.status(201).json("Login successful!", result); // 201 Created
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });


    // Get Single User 
    app.get("/user/:email", verifyJWT, async (req, res) => {
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

        // console.log(req.body);
        // Validate the role
        const validRoles = ["admin", "user"];
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

    // Create Flash Sale **************************************************
    app.post("/flash-sale", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const product = req.body;
        const existName = product.name

        const existingFlashSale = await flashSaleCollection.findOne({ name: existName });

        if (existingFlashSale) {
          return res.status(400).json({ message: "Flash Sale already exists, please update!" });
        }

        const result = await flashSaleCollection.insertOne(product);

        if (!result.acknowledged) {
          return res.status(500).json({ message: "Failed to create flash sale" });
        }

        res.status(201).json({ message: "Flash sale created successfully" });
      } catch (error) {
        console.error("Error creating flash sale:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Update Flash Sale **************************************************
    app.patch("/flash-sale/:id", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { discount, endTime, startTime } = req.body;

        const existingFlashSale = await flashSaleCollection.findOne({ _id: new ObjectId(id) });

        if (!existingFlashSale) {
          return res.status(400).json({ message: "Please Create Flash Sale!" });
        }

        const result = await flashSaleCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { discount, endTime, startTime } }
        );

        if (result.modifiedCount === 0) {
          return res.status(400).json({ message: "No changes made to the flash sale" });
        }


        res.status(200).json({ message: "Flash sale Update successfully" });
      } catch (error) {
        console.error("Error updating flash sale:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });


    // Get Flash Sale **************************************************
    app.get("/flash-sale", async (req, res) => {
      try {
        const now = new Date();
        const { search, page = 1, limit = 100  } = req.query;

        // Convert pagination values to numbers
        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        // Find an active flash sale
        const flashSale = await flashSaleCollection.findOne({
          startTime: { $lte: now.toISOString() }, // Convert `now` to an ISO string
          endTime: { $gte: now.toISOString() }   // Compare with ISO string
        });

        if (!flashSale) {
          // No active flash sale, return response with _id from the most recent flash sale (if any)
          const lastFlashSale = await flashSaleCollection.find().toArray();
          // console.log(lastFlashSale[0]._id);
          if (lastFlashSale.length > 0) {
            return res.status(200).json({
              message: "Update Flash Sale Time",
              _id: lastFlashSale[0]._id, // Get the _id of the most recent flash sale
            });
          } else {
            // No flash sale found in the collection at all
            return res.status(200).json({
              message: "Please Create a Flash Sale!!",
              _id: null,
              products: []
            });
          }
        }


        // Convert product IDs to ObjectId safely
        const productIds = flashSale.products
          .map(id => {
            try {
              return new ObjectId(id);
            } catch (error) {
              console.error(`Invalid product ID: ${id}`, error);
              return null;
            }
          })
          .filter(Boolean); // Remove invalid IDs

        if (productIds.length === 0) {
          return res.status(200).json({
            message: "No valid products found in this flash sale!",
            _id: flashSale._id,
            products: []
          });
        }

        // Build the query for discounted products only
        const query = { _id: { $in: productIds } };
        if (search) {
          query.name = { $regex: search, $options: "i" }; // Case-insensitive search
        }

        // Fetch all products from the database
        const allProducts = await productCollection.find(query).toArray();


        // Filter out only the discounted products
        const discountedProducts = allProducts
          .map(product => ({
            ...product,
            originalPrice: product.price,
            price: product.price - (product.price * flashSale.discount / 100),
          }))
          .filter(product => product.price < product.originalPrice); // Ensure only discounted products are included

        // Apply pagination after filtering discounted products
        const paginatedProducts = discountedProducts.slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber);

        if (paginatedProducts.length === 0) {
          return res.status(200).json({
            message: "No discounted products found for this flash sale!",
            _id: flashSale._id,
            products: []
          });
        }

        const allProduct = allProducts.length 
        const totalProducts = discountedProducts.length;
        const totalPages = Math.ceil(totalProducts / limitNumber);
        
        res.status(200).json({
          message: "Flash sale products retrieved successfully!",
          products: paginatedProducts,
          totalProducts: allProduct,
          pagination: {
            totalProducts,
            totalPages,
          },
          discount: flashSale.discount,
          endTime: flashSale.endTime,
          _id: flashSale._id,
        });
        

      } catch (error) {
        console.error("Error fetching flash sale:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });



    // Add Product ******************************************************
    app.post("/add-product", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const product = req.body;

        const result = await productCollection.insertOne(product);

        if (!result.acknowledged) {
          throw new Error("Product insertion failed");
        }
        res.status(201).json({ message: "Product added successfully" });
      } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Create Flash Sale 
    app.post("/flash-sale", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const product = req.body;
        const result = await flashSaleCollection.insertOne(product)
        if (!result.acknowledged) {
          throw new Error("Product insertion failed");
        }
        res.status(201).json({ message: "Flash product added successfully" });
      } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    })


    // add product to Flash SAle 
    app.patch("/add-flash-sale", async (req, res,) => {
      const { productId, userRole } = req.body;

      try {
        // step 1: check user
        const flashSale = await flashSaleCollection.findOne({ role: userRole });
        if (!flashSale) {
          return res.status(404).json({ success: false, message: "Flash Sale Not Found!" });
        }
        console.log(flashSale);
        // step 2: check duplicate data
        if (flashSale?.products?.some(id => id.toString() === productId)) {
          return res.status(409).json({ success: false, message: "Product already in flash sale!" })
        }
        // step 3: add to wishlist 
        const result = await flashSaleCollection.updateOne(
          { role: userRole },
          { $addToSet: { products: new ObjectId(String(productId)) } }
        )
        res.status(200).json({ success: true, message: "Added to flash sale successfully" });
      } catch (error) {
        console.error("Error in /add-cart:", error);
        res.status(500).json({ success: false, message: "Something went wrong!" });
      }
    })



    // Get All Product 
    app.get("/all-product", async (req, res) => {
      try {
        // Destructure query parameters
        const { search, sort, category, sub_category, brand, page = 1, limit = 9 } = req.query;

        // Build the query object
        const query = {};
        if (search) {
          query.name = { $regex: search, $options: "i" }; // Case-insensitive regex
        }
        if (sub_category) {
          query.sub_category = { $regex: category, $options: "i" }; // Case-insensitive regex
        }
        if (category) {
          query.category = { $regex: category, $options: "i" }; // Case-insensitive regex
        }
        if (sub_category) {
          query.sub_category = { $regex: sub_category, $options: "i" }; // Case-insensitive regex
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

        // Deduplicate categories and brands
        const brands = [...new Set(products.map((product) => product.brand))];
        const categories = [...new Set(products.map((product) => product.sub_category))];

        // Send the response
        res.json({ products, brands, categories, totalProducts });
      } catch (error) {
        // Error handling
        console.error(error);
        res.status(500).json({ error: "An error occurred while fetching products." });
      }
    });


    // remove from flash sale 
    app.patch("/remove-flash-sale-product", verifyJWT, async (req, res) => {
      try {
        const { flashSaleId, productId } = req.body;

        if (!flashSaleId || !productId) {
          return res.status(400).json({ error: "flashSaleId and productId are required" });
        }

        const result = await flashSaleCollection.updateOne(
          { _id: new ObjectId(flashSaleId) },
          { $pull: { products: new ObjectId(productId) } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ error: "Product not found in flash sale" });
        }

        return res.status(200).json({
          success: true,
          message: "Product removed from flash sale",
          result,
        });

      } catch (error) {
        console.error("Error removing product from flash sale:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
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
    // app.get("/manage-products/:email", verifyJWT, async (req, res) => {
    //   const email = req.params.email;
    //   // console.log(email);
    //   try {
    //     // Find the user based on the email
    //     const user = await userCollection.findOne({ email });

    //     if (!user) {
    //       return res.status(404).send({ message: "User not found!" });
    //     }
    //     // Find all products associated with this email
    //     const products = await productCollection.find({ email }).toArray();
    //     // console.log("products",products)
    //     res.send(products);
    //   } catch (error) {
    //     console.error("Error fetching products:", error);
    //     res.status(500).send({ message: "Server error occurred!" });
    //   }
    // });





    // Delete Product 
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

    // Update Product
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

    // Buy Products *****************************************************
    // Make Order
    app.post("/purchase", verifyJWT, async (req, res) => {
      try {
        const order = req.body;

        const result = await purchaseCollection.insertOne(order);

        if (!result.acknowledged) {
          throw new Error("Product insertion failed");
        }
        res.status(201).json({ message: "Product purchase successfully", result });
      } catch (error) {
        console.error("Error purchase product:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });


    //  Get my Order  =========== 
    app.get("/my-order/:id", verifyJWT, async (req, res) => {
      const userId = req.params.id;

      // Convert the product ID to ObjectId
      const objectId = new ObjectId(userId);

      try {
        const user = await userCollection.findOne({ _id: objectId });

        if (!user) {
          return res.status(404).send({ message: "User not found!" });
        }
        // Find all products associated with this email
        const products = await purchaseCollection.find({ userId }).toArray();
        // console.log("products",products)
        res.send(products);
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send({ message: "Server error occurred!" });
      }
    });

    // // get wishlist data 
    // app.get("/wishlist/:email", verifyJWT, async (req, res) => {
    //   const email = req.params.email;

    //   const user = await userCollection.findOne({ email });
    //   if (!user) {
    //     return res.status(404).json({ success: false, message: "User Not Found!" });
    //   }

    //   const wishlist = await productCollection.find(
    //     {
    //       _id: { $in: user.wishlist || [] }
    //     }
    //   ).toArray();
    //   res.send(wishlist);
    // })







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
