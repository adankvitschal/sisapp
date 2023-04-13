import express from 'express';
import bodyParser from 'body-parser';
import { Level } from 'level';
import { nanoid } from 'nanoid';

const app = express();
const classes_db = new Level('./sisapp_data/classes');
const students_db = new Level('./sisapp_data/students');
const enrollment_db = new Level('./sisapp_data/enrollment');

// Set the view engine to EJS
app.set('view engine', 'ejs');
//app.set('views', path.join(__dirname, 'views'));

// middleware for parsing JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
  const { studentName, parentName, birthDate, phone, email, donationPermission} = req.body;
  const id = nanoid();
  students_db.put(id, JSON.stringify({ studentName, parentName, birthDate, phone, email, donationPermission}), (err) => {
    if (err) {
      console.error('Error storing student data:', err);
      res.status(500).send('Error storing student data');
    } else {
      res.send('Student data stored successfully');
    }
  });
});

app.get('/new-student', (req, res) => {
  res.render('new-student');
});

async function getStudentClass(student, year) {
  for await (const [key, value] of enrollment_db.iterator()) {
    const enrollment = JSON.parse(value);
    if(enrollment.year == year
    && enrollment.studentName === student.studentName) {
      return enrollment.className;
    }
  }
  return 'Não matriculado';
}

async function getAllStudents() {
  const students = [];
  const currentYear = new Date().getFullYear();
  for await (const [key, value] of students_db.iterator()) {
    const studentInfo = JSON.parse(value);
    studentInfo.currentClass = await getStudentClass(studentInfo, currentYear);
    students.push(studentInfo);
  }
  return students;
}

app.get('/students', async (req, res) => {
  try {
    const students = await getAllStudents();
    const schoolClasses = await getActiveClasses();
    console.log('Students:', students);
    console.log('Classes:', schoolClasses);
    res.render('students', {students, schoolClasses});
  } catch (error) {
    console.error('Error reading students database:', error);
    res.status(500).send('Error reading students database');
  }  
});

async function getEnrolledStudents(year) {
  const students = [];
  for await (const [key, value] of students_db.iterator()) {
    const student = JSON.parse(value);
    student.currentClass = await getStudentClass(student, year);
    if(student.currentClass !== 'Não matriculado') {
      students.push(student);
    }
  }
  return students;
}

async function getNonEnrolledStudents(year) {
  const nonEnrolledStudents = [];
  for await (const [key, value] of students_db.iterator()) {
    const student = JSON.parse(value);
    console.log(student);
    const currentClass = await getStudentClass(student, year);
    console.log(student.studentName + " current class:", currentClass);
    if (!currentClass
    || currentClass === 'Não matriculado') {
      nonEnrolledStudents.push(student);
    }
  }
  return nonEnrolledStudents;
}

app.get('/new-enrollment', async (req, res) => {
  const currentYear = new Date().getFullYear();
  const students = await getNonEnrolledStudents(currentYear);
  const schoolClasses = await getActiveClasses();
  res.render('new-enrollment', {students, schoolClasses});
});

app.post('/new-enrollment', (req, res) => {
  const { year, studentName, className } = req.body;
  const id = nanoid();
  enrollment_db.put(id, JSON.stringify({ year, studentName, className }), (err) => {
    if (err) {
      console.error('Error storing enrollment data:', err);
      res.status(500).send('Error storing enrollment data');
    } else {
      res.send('Enrollment data stored successfully');
    }
  });
});

app.get('/enrollments', async (req, res) => {
  var yearFilter = req.query.yearFilter;
  if(!yearFilter) {
    yearFilter = new Date().getFullYear();
  }
  try {
    const enrollments = [];
    for await (const [key, value] of enrollment_db.iterator()) {
      const enrollmentInfo = JSON.parse(value);
      enrollments.push(enrollmentInfo);
    }
    res.render('enrollments', {yearFilter, enrollments});
  } catch (error) {
    console.error('Error reading enrollments database:', error);
    res.status(500).send('Error reading enrollments database');
  }
});

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
