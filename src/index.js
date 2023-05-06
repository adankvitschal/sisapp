import express from 'express';
import bodyParser from 'body-parser';
import { Level } from 'level';
import { customAlphabet } from 'nanoid/non-secure'
const nanoid = customAlphabet('123456789ABCDEFGHIJKLMNOPQRTUVWXYZ', 12);
import { saleReceipt } from './receiptPrinter.js';
//import { nanoid } from 'nanoid';

const app = express();
const classes_db = new Level('./sisapp_data/classes');
const students_db = new Level('./sisapp_data/students');
const enrollment_db = new Level('./sisapp_data/enrollment');
const donation_requests_db = new Level('./sisapp_data/donation_requests');
const events_db = new Level('./sisapp_data/events');
const sales_db = new Level('./sisapp_data/sales');
const sale_cancellations_db = new Level('./sisapp_data/sale_cancellations');

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

app.post('/remove-enrollment', async (req, res) => {
  const { year, studentName, className } = req.body;
  for await (const [key, value] of enrollment_db.iterator()) {
    const enrollment = JSON.parse(value);
    if(enrollment.studentName === studentName
    && enrollment.year === year
    && enrollment.className === className) {
      enrollment_db.del(key, (err) => {
        if (err) {
          console.error('Error removing enrollment data:', err);
          res.status(500).send('Error removing enrollment data');
        }
      });
      console.log('Enrollment removed: ' + JSON.stringify(enrollment));
      res.redirect('/enrollments?year=' + year);
    }
  };
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
      const request_id = nanoid();
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

async function getEventRevenue(event) {
  let revenue = 0;
  for await (const [key, value] of sales_db.iterator()) {
    const sale = JSON.parse(value);
    if(sale.event_id === event.id) {
      revenue += Number(sale.sale_total);
    }
  }
  return revenue;
}

app.get('/events', async (req, res) => {
  const events = [];
  for await (const [key, value] of events_db.iterator()) {
    const event = JSON.parse(value);
    event.id = key;
    event.revenue = await getEventRevenue(event);
    events.push(event);
  }
  console.log(events);
  res.render('events', {events});
})

async function getLatestSales(event_id) {
  const latest_sales = [];
  for await (const [key, value] of sales_db.iterator()) {
    const sale = JSON.parse(value);
    if(sale.event_id === event_id) {
      sale.id = key;
      try {
        sale.cancellation = JSON.parse(await sale_cancellations_db.get(key));
      } catch(error) {
        // ignore
      }
      latest_sales.push(sale);
      if(latest_sales.length >= 5) {
        break;
      }
    }
  }
  return latest_sales;
}

app.get('/new-sale', async (req, res) => {
  const event_id = req.query.event_id;
  if(!event_id) {
    res.status(400).send('Missing event_id');
    return;
  }
  const event = JSON.parse(await events_db.get(event_id));
  if(!event) {
    res.status(404).send('Event not found');
    return;
  }
  event.id = event_id;
  const latest_sales = await getLatestSales(event_id);
  res.render('new-sale', {event, latest_sales});
});

app.post('/new-sale', async (req, res) => {
  const { event_id, item_name, item_quantity, item_price, sale_total, buyer_name, buyer_cpf } = req.body;
  console.log(req.body);
  const id = nanoid();
  sales_db.put(id, JSON.stringify({ event_id, ts: Date.now(), item_name, item_quantity, item_price, sale_total, buyer_name, buyer_cpf }), (err) => {
    if (err) {
      console.error('Error storing sale data:', err);
      res.status(500).send('Error storing sale data');
    } else {
      res.redirect('/new-sale?event_id=' + event_id);
    }
  });
  const event_info = JSON.parse(await events_db.get(event_id));
  saleReceipt({id, event_info, item_name, item_quantity, item_price, sale_total, buyer_name, buyer_cpf});
});

app.post('/cancel-sale', async (req, res) => {
  const { event_id, sale_id, reason } = req.body;
  console.log(req.body);
  sale_cancellations_db.put(sale_id, JSON.stringify({ ts: Date.now(), reason }), (err) => {
    if (err) {
      console.error('Error storing sale cancellation data:', err);
      res.status(500).send('Error storing sale cancellation data');
    } else {
      res.redirect('/new-sale?event_id=' + event_id);
    }
  });
});

app.get('/new-event', async (req, res) => {
  res.render('new-event');
});

app.post('/new-event', (req, res) => {
  const { event_name, event_date, item_name, item_description, item_price } = req.body;
  const id = nanoid();
  events_db.put(id, JSON.stringify({ event_name, event_date, item_name, item_description, item_price }), (err) => {
    if (err) {
      console.error('Error storing event data:', err);
      res.status(500).send('Error event enrollment data');
    } else {
      res.redirect('/new-event');
    }
  });
});

app.use('/img', express.static('img'));
app.use('/css', express.static('css'));
app.use('/jsbarcode', express.static('node_modules/jsbarcode/dist'));
app.use('/bootstrap', express.static('node_modules/bootstrap/dist'));
app.use('/fontawesome-free', express.static('node_modules/@fortawesome/fontawesome-free'));

// start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
