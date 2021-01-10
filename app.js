//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://admin-xueming:" + process.env.MONGO_PASSCODE + "@todolist.agc53.mongodb.net/UserDB", { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);

// item schema
const itemsSchema = {
  content: String,
};
const Item = mongoose.model("Item", itemsSchema);

const item1 = new Item({
  content: "Welcome to your todolist!",
});

const item2 = new Item({
  content: "Hit the + button to add a new item.",
});

const item3 = new Item({
  content: "<-- Hit this to delete an item.",
});

const defaultItems = [item1, item2, item3];
//const guestItems = []

// user schema
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  items: [itemsSchema],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/todolist",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      // console.log(profile);

      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", function (req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/home");
  } else {
    res.render("login");
  }
});

app.post("/", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  console.log(user);

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        User.findById(req.user.id, function (err, foundUser) {
          if (foundUser.items.length === 0) {
            foundUser.items = defaultItems;
            foundUser.save();
          }
          res.redirect("/home");
        });
      });
    }
  });
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.post("/register", function (req, res) {
  User.register({ username: req.body.username }, req.body.password, function (err, user) {
    if (err) {
      res.jsonp({ Error: err });
      //res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function () {
        User.findById(req.user.id, function (err, foundUser) {
          if (foundUser.items.length === 0) {
            foundUser.items = defaultItems;
            foundUser.save();
          }
          res.redirect("/home");
        });
      });
    }
  });
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/todolist", passport.authenticate("google", { failureRedirect: "/" }), function (req, res) {
  // Successful authentication, redirect to secrets.
  User.findById(req.user.id, function (err, foundUser) {
    if (foundUser.items.length === 0) {
      foundUser.items = defaultItems;
      foundUser.save();
    }
    res.redirect("/home");
  });
});

app.get("/home", function (req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function (err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          res.render("home", { newListItems: foundUser.items });
          //
        }
      }
    });
  } else {
    res.redirect("/");
  }
});

app.post("/home", function (req, res) {
  const item = new Item({
    content: req.body.newItem,
  });

  User.findById(req.user.id, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        //guestItems.push(item)

        foundUser.items.push(item);
        foundUser.save();
        res.redirect("home");
      }
    }
  });
});

app.post("/home/delete", function (req, res) {
  //guestItems.pop()
  //res.redirect("/home");

  const checkedItemId = req.body.checkbox;

  User.findByIdAndUpdate(req.user.id, { $pull: { items: { _id: checkedItemId } } }, function (err, foundUser) {
    if (!err) {
      res.redirect("/home");
    }
  });
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function () {
  console.log("Server has started successfully.");
});
