import express from 'express';
import bodyParser from 'body-parser';
import { Level } from 'level';
import { nanoid } from 'nanoid';

const app = express();
const classes_db = new Level('./sisapp_data/classes');
const students_db = new Level('./sisapp_data/students');

// Set the view engine to EJS
app.set('view engine', 'ejs');
//app.set('views', path.join(__dirname, 'views'));

// middleware for parsing JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/new-student', (req, res) => {
  res.render('new-student');
});

app.get('/students', (req, res) => {
  res.render('students');
});

app.get('/donations-form', (req, res) => {
  res.render('donations-form');
});

app.get('/new-class', (req, res) => {
  res.render('new-class');
});

async function getActiveClasses() {
  const activeClasses = [];
  for await (const [key, value] of classes_db.iterator()) {
    const classInfo = JSON.parse(value);
    if (classInfo.classState === 'Ativa') {
      activeClasses.push(classInfo);
    }
  }
  return activeClasses;
}

app.get('/classes', async (req, res) => {
  const activeClasses = [];
  const archivedClasses = [];

  // Retrieve all classes from LevelDB
  try {
    for await (const [key, value] of classes_db.iterator()) {
      const classInfo = JSON.parse(value);
      // Check the state of the class and add it to the corresponding array
      if (classInfo.classState === 'Ativa') {
        activeClasses.push(classInfo);
      } else if (classInfo.classState === 'Arquivada') {
        archivedClasses.push(classInfo);
      }
    }
      res.render('classes', { activeClasses, archivedClasses });
  } catch (error) {
    console.error('Error reading classes database:', error);
    res.status(500).send('Error reading classes database');
  }  
});

app.post('/new-class', (req, res) => {
  const { className, classLocation, classState} = req.body;
  const id = nanoid();
  classes_db.put(id, JSON.stringify({ className, classLocation, classState}), (err) => {
    if (err) {
      console.error('Erro ao armazenar informações da nova turma:', err);
      res.status(500).send('Erro ao armazenar informações da nova turma');
    } else {
      res.send('Nova turma criada com sucesso!');
    }
  });
});

app.post('/new-student', (req, res) => {
  const { studentName, parentName, birthDate} = req.body;

  // Generate a unique ID for the student
  const id = nanoid();

  // Store the student data in LevelDB
  db.put(id, JSON.stringify({ studentName, parentName, birthDate}), (err) => {
    if (err) {
      console.error('Error storing student data:', err);
      res.status(500).send('Error storing student data');
    } else {
      res.send('Student data stored successfully');
    }
  });
});

// define routes for registering students and accepting donations
app.post('/students', (req, res) => {
  // code for registering students
});

app.post('/donations', (req, res) => {
    const { parentName, amount } = req.body;
    const uniqueCode = "123456";
    console.log("Registrando doação de " + parentName + " no valor de " + amount + " reais.");
    // save donation data to the database
    // send unique code in response
    res.status(201).json({ uniqueCode });
});

// start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
