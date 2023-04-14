import express from 'express';
import bodyParser from 'body-parser';
import { Level } from 'level';
import { nanoid } from 'nanoid';

const app = express();
const classes_db = new Level('./sisapp_data/classes');
const students_db = new Level('./sisapp_data/students');
const enrollment_db = new Level('./sisapp_data/enrollment');
const donation_requests_db = new Level('./sisapp_data/donation_requests');

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
      res.redirect('/new-student');
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
      res.redirect('/new-enrollment?year=' + year);
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

app.get('/donation-requests', async (req, res) => {
  let year = req.query.year;
  let month = req.query.month;
  if(!year) {
    year = new Date().getFullYear();
  }
  if(!month) {
    month = new Date().getMonth();
  }
  try {
    const donationRequests = [];
    for await (const [key, value] of donation_requests_db.iterator()) {
      const donationRequest = JSON.parse(value);
      if(donationRequest.year == year
      && donationRequest.month == month) {
        donationRequest.id = key;
        donationRequests.push(donationRequest);
      }
    }
    donationRequests.sort((a,b) => (a.classNasme > b.className) ? 1 : ((b.className > a.className) ? -1 : 0))
    res.render('donation-requests', {year, month, donationRequests});
  } catch (error) {
    console.error('Error reading donation requests database:', error);
    res.status(500).send('Error reading donation requests database');
  }
});

app.post('/gen-donation-requests', async (req, res) => {
  const { year, month } = req.body;
  console.log('gen-donation-requests req body:', req.body);
  try {
    const students = await getEnrolledStudents(year);
    for (const student of students) {
      const request_id = nanoid(10);
      const studentName = student.studentName;
      const className = student.currentClass;
      donation_requests_db.put(request_id, JSON.stringify({ year, month, studentName, className}), (err) => {
        if(err) {
          throw err;
        }
      });
    }
    res.redirect('/donation-requests?year=' + year + '&month=' + month);
  } catch (error) {
    console.error('Error storing donation requests data:', err);
    res.status(500).send('Error storing donation requests data');
  }
});

app.use('/jsbarcode', express.static('node_modules/jsbarcode'));
app.use('/img', express.static('img'));

// start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
