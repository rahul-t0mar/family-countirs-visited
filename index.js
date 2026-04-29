import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "",   // add your database name here
  password: "",   // add your postgres password here
  port: 5432,
});
db.connect();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Rahul", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];

async function checkVisited() {
  const result = await db.query("SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1; ", [currentUserId]);
  let visitedCountries = [];
  result.rows.forEach((country) => {
    visitedCountries.push(country.country_code);
  });
  return visitedCountries;
}

async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}

//GET home page
app.get("/", async (req, resp) => {
  const countries = await checkVisited();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    resp.redirect("/user");
  }
  resp.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
  });
});


app.post("/add", async (req, resp) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();

  try {
    const result = await db.query(
      "SELECT code FROM countries WHERE LOWER(name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    // ✅ Check if country exists
    if (result.rows.length === 0) {
      const countries = await checkVisited();
      return resp.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        error: "Country not found, try again.",
      });
    }
    let countryCode = result.rows[0].code;;

    if (countryCode === "IO") {
      countryCode = "IN";
    }

    // const countryCode = result.rows[0].code;

    try {
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      resp.redirect("/");
    } catch (err) {
      const countries = await checkVisited();
      resp.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        error: "Country has already been added, try again.",
      });
    }

  } catch (err) {
    console.log(err);
    resp.send("Something went wrong.");
  }
});



app.post("/user", async (req, resp) => {
  if (req.body.add === "new") {
    resp.render("new.ejs");
  } else {
    currentUserId = parseInt(req.body.user);
    resp.redirect("/");
  }
});

app.post("/new", async (req, resp ) => {
  const name = req.body.name;
  const color = req.body.color;

  const result = await db.query(
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  const id = result.rows[0].id;
  currentUserId = id;

  resp.redirect("/");  
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
