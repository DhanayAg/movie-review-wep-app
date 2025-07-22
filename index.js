import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import dotenv from "dotenv";

const app= express();
const port = 3000;

dotenv.config();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.get("/", async(req,res) => {
    try {
        const result = await db.query("SELECT genre FROM movie_genre");
        res.render("home.ejs", { genres: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading genres.");
    }
})

app.get("/genre/:genreName", async (req, res) => {
  const genreName = req.params.genreName.replace(/-/g, ' ');
  const sortBy = req.query.sort || "title"; // default sorting

  const sortOptions = {
    rating: "rating DESC",
    year: "year DESC",
    title: "title ASC"
  };

  const orderBy = sortOptions[sortBy] || "title ASC";

  try {
    const genreResult = await db.query(
      "SELECT id FROM movie_genre WHERE LOWER(genre) = $1",
      [genreName.toLowerCase()]
    );

    if (genreResult.rows.length === 0) {
      return res.status(404).send("Genre not found.");
    }

    const genreId = genreResult.rows[0].id;

    const movieResult = await db.query(
        `SELECT id, title, year, rating, basic_description, genre_id FROM movies_summary WHERE genre_id = $1 ORDER BY ${orderBy}`,
        [genreId]
    );

    res.render("genre.ejs", {
      genre: genreName,
      movies: movieResult.rows,
      selectedSort: sortBy
    });
  } catch (err) {
    console.error("Error fetching genre movies:", err);
    res.status(500).send("Error fetching genre movies.");
  }
});


app.get("/movie/:id", async (req, res) => {
  const movieId = req.params.id;

  try {
    const result = await db.query(
      "SELECT title, year, director, rating, summary FROM movies_summary WHERE id = $1",
      [movieId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Movie not found.");
    }

    res.render("movie.ejs", { movie: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading movie details.");
  }
});


// Adding movies
app.get("/movies/add", async (req, res) => {
  try {
    const genres = await db.query("SELECT id, genre FROM movie_genre ORDER BY genre ASC");
    res.render("add.ejs", { genres: genres.rows });
  } catch (err) {
    console.error("Error loading genres for form:", err);
    res.status(500).send("Could not load form.");
  }
});

app.post("/movies/add", async (req, res) => {
  const { title, year, director, rating, basic_description, summary, genre_id } = req.body;

  try {
    await db.query(
      `INSERT INTO movies_summary (title, year, director, rating, basic_description, summary, genre_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [title, year, director, rating, basic_description, summary, genre_id]
    );

    // Get genre name to redirect to its page
    const genreResult = await db.query("SELECT genre FROM movie_genre WHERE id = $1", [genre_id]);
    const genreName = genreResult.rows[0].genre;

    res.redirect(`/genre/${genreName}`);
  } catch (err) {
    console.error("Error inserting movie:", err);
    res.status(500).send("Error adding movie.");
  }
});



// Deleting
app.post("/delete/:id", async (req, res) => {
  const movieId = req.params.id;
  const genreId = req.body.genreId;

  try {
    await db.query("DELETE FROM movies_summary WHERE id = $1", [movieId]);
    const genreNameResult = await db.query("SELECT genre FROM movie_genre WHERE id = $1", [genreId]);

    if (genreNameResult.rows.length === 0) {
      return res.redirect("/");
    }

    const genreName = genreNameResult.rows[0].genre;
    res.redirect(`/genre/${genreName}`);
  } catch (err) {
    console.error("Error deleting movie:", err);
    res.status(500).send("Failed to delete movie.");
  }
});



// Editing
app.get("/edit/:id", async (req, res) => {
  const movieId = req.params.id;
  try {
    const movieResult = await db.query("SELECT * FROM movies_summary WHERE id = $1", [movieId]);
    const genresResult = await db.query("SELECT * FROM movie_genre");

    if (movieResult.rows.length === 0) {
      return res.status(404).send("Movie not found.");
    }

    res.render("edit.ejs", {
      movie: movieResult.rows[0],
      genres: genresResult.rows
    });
  } catch (err) {
    console.error("Error loading movie for editing:", err);
    res.status(500).send("Failed to load movie data.");
  }
});

app.post("/edit/:id", async (req, res) => {
  const movieId = req.params.id;
  const { title, year, director, rating, basic_description, summary, genre_id } = req.body;

  try {
    await db.query(
      `UPDATE movies_summary 
       SET title = $1, year = $2, director = $3, rating = $4, 
           basic_description = $5, summary = $6, genre_id = $7 
       WHERE id = $8`,
      [title, year, director, rating, basic_description, summary, genre_id, movieId]
    );

    const genreNameRes = await db.query("SELECT genre FROM movie_genre WHERE id = $1", [genre_id]);
    const genreName = genreNameRes.rows[0].genre;

    res.redirect(`/genre/${genreName}`);
  } catch (err) {
    console.error("Error updating movie:", err);
    res.status(500).send("Failed to update movie.");
  }
});



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
