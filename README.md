# Mobile Shop Server

This repository contains the backend implementation of the Mobile Shop platform, built using Node.js and Express.js.

---

## Features

- **Role-Based Authentication**:
  - Buyer, Seller, and Admin roles with specific access and permissions.
- **Product Management**:
  - Sellers can add, edit, and delete products.
- **User Management**:
  - Admins can manage user accounts and roles.


---

## Technology Stack

- **Node.js**: JavaScript runtime for building the server.
- **Express.js**: Framework for server-side logic.
- **MongoDB**: NoSQL database for data storage.
- **Firebase**: For authentication and user management.
- **Dotenv**: For managing environment variables.

---

## Installation and Setup

### Prerequisites
- Ensure **Node.js** and **npm** are installed.
- Install and configure **MongoDB**.

### Steps

1. **Clone the repository**:
   ```bash
   git clone <server-repo-url>
   cd server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   - Create a `.env` file in the root directory.
   - Add the following variables:
     ```env
     PORT=5000
     MONGO_URI=<your-mongo-db-uri>
     STRIPE_SECRET_KEY=<your-stripe-secret-key>
     FIREBASE_API_KEY=<your-firebase-api-key>
     FIREBASE_AUTH_DOMAIN=<your-firebase-auth-domain>
     FIREBASE_PROJECT_ID=<your-firebase-project-id>
     FIREBASE_STORAGE_BUCKET=<your-firebase-storage-bucket>
     FIREBASE_MESSAGING_SENDER_ID=<your-firebase-messaging-sender-id>
     FIREBASE_APP_ID=<your-firebase-app-id>
     ```

4. **Start the server**:
   ```bash
   npm start
   ```

5. **API Testing**:
   - Use tools like **Postman** or **Insomnia** to test the API endpoints.

---

## Folder Structure

```
server
├── controllers      # Logic for handling API requests
├── models           # Mongoose schemas and models
├── routes           # API routes
├── middleware       # Custom middleware (e.g., authentication)
├── config           # Configuration files (e.g., database, Firebase)
├── utils            # Utility functions
├── .env.example     # Example environment variables
├── server.js        # Main server entry point
└── package.json     # Dependencies and scripts
```

---

## API Endpoints

### Authentication
- `POST /auth/login`: User login
- `POST /auth/register`: User registration

### Products
- `GET /products`: Fetch all products
- `POST /products`: Add a product (Seller only)
- `PUT /products/:id`: Update a product (Seller only)
- `DELETE /products/:id`: Delete a product (Seller only)

### Admin
- `GET /admin/users`: Fetch all users
- `DELETE /admin/users/:id`: Delete a user

---

## Contribution Guidelines

1. Fork the repository.
2. Create a new branch for your feature/fix.
3. Commit your changes with clear messages.
4. Create a pull request for review.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

## Contact

For any queries, please reach out to:
- **Email**: robiul0278@gmail.com
