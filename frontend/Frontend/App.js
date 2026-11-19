
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = 3000;

const MONGO_URL = "mongodb://127.0.0.1:27017";
const client = new MongoClient(MONGO_URL);

let users;

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    next();
}
app.use(express.urlencoded({ extended: false }));

app.use(
    session({
        secret: process.env.SESSION_SECRET || "change-this-to-a-long-random-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 60 * 60 * 1000
        }
    })
);

// Password hashing
function hashPassword(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, key) => {
            if (err) return reject(err);
            resolve(key.toString("hex"));
        });
    });
}

// Compare submitted password with stored hash
async function verifyPassword(password, salt, storedHash) {
    const hash = await hashPassword(password, salt);

    const hashBuffer = Buffer.from(hash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    if (hashBuffer.length !== storedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(hashBuffer, storedBuffer);
}


app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "home.html"));
});

app.get("/features", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "features.html"));
});

// Feature 1: Photo Upload
app.get("/feature/photo-upload", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "photo-upload.html"));
});

// Feature 2: GPS Location
app.get("/feature/location", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "location.html"));
});

// Feature 3: Complaint Registration
app.get("/feature/complaint", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "complaint.html"));
});

// Feature 4: Complaint Status
app.get("/feature/status", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "status.html"));
});

// Feature 5: Notifications
app.get("/feature/notifications", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "notifications.html"));
});

// Feature 6: Report History
app.get("/feature/history", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "history.html"));
});

// Feature 7: Hazard Map
app.get("/feature/map", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "map.html"));
});

// Feature 8: Hazard Severity
app.get("/feature/severity", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "severity.html"));
});

// Feature 9: Admin Dashboard
app.get("/feature/admin", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/about", (req, res) => {
    res.sendFile(path.join(__dirname, "about.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/signup", (req, res) => {
    // Make sure this filename exactly matches your actual file.
    res.sendFile(path.join(__dirname, "register.html"));
});

// Registration
app.post("/register", async (req, res) => {
    try {
        const fullName = (req.body.fullName || "").trim();
        const email = (req.body.email || "").trim().toLowerCase();
        const password = req.body.password || "";
        const confirmPassword = req.body.confirmPassword || "";

        if (!fullName || !email || !password || !confirmPassword) {
            return res.status(400).send("Please fill in all fields.");
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).send("Please enter a valid email address.");
        }

        if (password.length < 8) {
            return res.status(400).send(
                "Password must contain at least 8 characters."
            );
        }

        if (password !== confirmPassword) {
            return res.status(400).send(
                'Passwords do not match. <a href="/signup">Try again</a>'
            );
        }

        const existingUser = await users.findOne({ email });

        if (existingUser) {
            return res.status(409).send(
                'This email is already registered. <a href="/signup">Try again</a>'
            );
        }

        const salt = crypto.randomBytes(16).toString("hex");
        const passwordHash = await hashPassword(password, salt);

        await users.insertOne({
            fullName,
            email,
            passwordSalt: salt,
            passwordHash,
            createdAt: new Date()
        });

        res.status(201).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Registration Successful</title>
            </head>
            <body>
                <h2>Registration successful!</h2>
                <p>Your account has been saved.</p>
                <a href="/login">Go to Login</a>
            </body>
            </html>
        `);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).send(
                'This email is already registered. <a href="/signup">Try again</a>'
            );
        }

        console.error("Registration error:", error);
        res.status(500).send("Registration failed. Please try again.");
    }
});

// Login
app.post("/login", async (req, res) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const password = req.body.password || "";

        if (!email || !password) {
            return res.status(400).send(
                'Please enter your email and password. <a href="/login">Try again</a>'
            );
        }

        const user = await users.findOne({ email });

        if (!user) {
            return res.status(401).send(
                'Invalid email or password. <a href="/login">Try again</a>'
            );
        }

        const isValid = await verifyPassword(
            password,
            user.passwordSalt,
            user.passwordHash
        );

        if (!isValid) {
            return res.status(401).send(
                'Invalid email or password. <a href="/login">Try again</a>'
            );
        }

        req.session.user = {
            id: user._id.toString(),
            fullName: user.fullName,
            email: user.email
        };

        req.session.save((err) => {
            if (err) {
                console.error("Session error:", err);
                return res.status(500).send("Login failed. Please try again.");
            }

            res.redirect("/features");
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send("Login failed. Please try again.");
    }
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Could not log out.");
        }

        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

// Serve CSS, JS, and images after page routes
app.use(express.static(__dirname));

async function startServer() {
    try {
        await client.connect();

        const db = client.db("road_hazard_db");
        users = db.collection("users");

        await users.createIndex({ email: 1 }, { unique: true });

        app.listen(PORT, () => {
            console.log("MongoDB connected successfully!");
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Could not start server:", error.message);
    }
}

startServer();
