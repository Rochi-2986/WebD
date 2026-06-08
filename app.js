const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// ======================= Middleware =======================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie:{
        maxAge: 1000 * 60 * 60 * 24
    }
}));
app.use((req, res, next) => {
    res.locals.islogin = req.session.islogin || false;
    res.locals.name = req.session.name || null;
    res.locals.role = req.session.role || "guest";
    next();
});

// ======================= MongoDB =======================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => {
    console.error("MongoDB Connection Failed");
    console.error(err);
    process.exit(1);
});
// ======================= Schemas =======================
const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        trim:true,
        minlength:3
    },
    email:{
        type:String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true
    },
    password:{
        type:String,
        required:true
    },
    role:{
        type:String,
        default:"user"
    }
});


const User = mongoose.model('User', userSchema);

const orderSchema = new mongoose.Schema({
   shirts:{type:Number,default:0},
pants:{type:Number,default:0},
suits:{type:Number,default:0},
sarees:{type:Number,default:0},
jackets:{type:Number,default:0},
others:{type:Number,default:0},
socks:{type:Number,default:0},
    special_instructions: String,
    username: String,
    pickup_address: String,
    drop_address: String,
    date: String,
    time: String,
    price: Number,
    status:{
    type:String,
    default:"Pending"
},
createdAt:{
    type:Date,
    default:Date.now
}
});

const Order = mongoose.model('Order', orderSchema);

// ======================= Global Session Data =======================
app.use((req, res, next) => {
    res.locals.islogin = req.session.islogin || false;
    res.locals.name = req.session.name || null;
    next();
});

// ======================= Helper Middleware =======================
function requireLogin(req, res, next) {
    if (req.session.islogin) {
        return next();
    }

    res.redirect('/login');
}

function requireAdmin(req,res,next){

    if(
        req.session.islogin &&
        req.session.role === "admin"
    ){
        return next();
    }

    res.send("Access Denied");
}
// ======================= Routes =======================

// Home Page
app.get('/', (req, res) => {
    res.render('index', {
        islogin: req.session.islogin || false,
        name: req.session.name || null
    });
});

app.get('/home', (req, res) => {
    res.redirect('/');
});

// ======================= Login =======================
app.get('/login', (req, res) => {
    res.render('login');
});
app.post('/login', async (req, res) => {
    try {

        const { email, password } = req.body;

        console.log("LOGIN:", req.body);

        const user = await User.findOne({ email });
        console.log("FOUND USER:", user);

        if (!user) {
            return res.send(`
                <script>
                    alert('User not found');
                    window.location='/login';
                </script>
            `);
        }

        const match = await bcrypt.compare(password,user.password);

if(!match) {
            return res.send(`
                <script>
                    alert('Incorrect password');
                    window.location='/login';
                </script>
            `);
        }

        req.session.islogin = true;
        req.session.name = user.username;
        req.session.userId = user._id;
        req.session.role = user.role;
        req.session.save(() => {
    if(user.role === "admin"){
        return res.redirect("/admin");
    }
    res.redirect('/');
});

    } catch (err) {
    console.log(err);
    res.status(500).send('Server Error');
}
});
// ======================= Signup =======================
app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    try {

        const {
            username,
            email,
            password,
            confirmPassword
        } = req.body;

        console.log("SIGNUP:", req.body);

        if(password !== confirmPassword){
            return res.send(`
                <script>
                    alert('Passwords do not match');
                    window.location='/signup';
                </script>
            `);
        }

        if(!username || !email || !password){
            return res.status(400).send("All fields are required");
        }

        // rest of your code...
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if(!emailRegex.test(email)){
    return res.send(`
        <script>
            alert('Enter a valid email');
            window.location='/signup';
        </script>
    `);
}

        console.log("SIGNUP:", req.body);

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.send(`
                <script>
                    alert('Email already registered');
                    window.location='/signup';
                </script>
            `);
        }

     if(password.length < 6){
    return res.send(`
        <script>
            alert('Password must be at least 6 characters');
            window.location='/signup';
        </script>
    `);
}
        const hashedPassword = await bcrypt.hash(password,10);

const newUser = new User({
    username,
    email,
    password: hashedPassword,
     role: email === "admin@gmail.com" ? "admin" : "user"
});

        await newUser.save();

        console.log("USER SAVED");

        res.redirect('/login');

    } catch (err) {
        if(err.code === 11000){
    return res.send(`
        <script>
            alert('Email already exists');
            window.location='/signup';
        </script>
    `);
}

console.log(err);
res.status(500).send('Server Error');
    }
});
// ======================= Logout =======================
// Show logout confirmation page
app.get('/logout', (req, res) => {
    res.render('logout');
});

// Actually logout user
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Logout failed");
        }

        res.redirect('/');
    });
});

// ======================= Profile =======================
app.get('/profile', requireLogin, (req, res) => {
    res.render('profile', {
        islogin: true,
        name: req.session.name
    });
});

// ======================= Static Pages =======================
app.get('/about', (req, res) => {
    res.render('about',{
        islogin:req.session.islogin,
        name:req.session.name
    });
});

app.get('/service', (req, res) => {
    res.render('service',{
        islogin:req.session.islogin,
        name:req.session.name
    });
});

app.get('/contact', (req, res) => {
    res.render('contact',{
        islogin:req.session.islogin,
        name:req.session.name
    });
});
// ======================= Contact Forms =======================
app.post('/faq', (req, res) => {
    res.send(
        "<script>alert('Question Received');window.location='/contact';</script>"
    );
});

app.post('/feedback', (req, res) => {
    res.send(
        "<script>alert('Feedback Submitted');window.location='/contact';</script>"
    );
});

// ======================= Order Flow =======================

// Order Page
app.get('/order', requireLogin, (req, res) => {
    res.render('order');
});

// Submit Clothes
app.post('/submit-order',requireLogin, async (req, res) => {

    const data = {
        shirts: parseInt(req.body.shirt) || 0,
        pants: parseInt(req.body.pants) || 0,
        suits: parseInt(req.body.suit) || 0,
        sarees: parseInt(req.body.saree) || 0,
        jackets: parseInt(req.body.jacket) || 0,
        others: parseInt(req.body.other) || 0,
        socks: parseInt(req.body.socks) || 0,
        special_instructions: req.body.special_instructions || '',
        username: req.session.name
    };
   const totalItems =
    data.shirts +
    data.pants +
    data.suits +
    data.sarees +
    data.jackets +
    data.others +
    data.socks;

if(totalItems === 0){
    return res.send(
        "<script>alert('Please select at least one item');window.location='/order';</script>"
    );
}
    const price =
        (data.shirts * 10) +
        (data.pants * 10) +
        (data.suits * 15) +
        (data.sarees * 12) +
        (data.jackets * 15) +
        (data.others * 8) +
        (data.socks * 2);

    res.render('address', {
        data,
        price
    });
});

// Submit Address
app.post('/address',requireLogin, async (req, res) => {

    if(!req.body.paddress || !req.body.daddress){
    return res.send("Address required");
}
    if(!req.body.date || !req.body.time){
    return res.send("Pickup date and time required");
}
    try {
        if(!req.body.data){
    return res.status(400).send("Invalid order data");
}
        const data = JSON.parse(req.body.data);

        data.pickup_address = req.body.paddress;
        data.drop_address = req.body.daddress;
        data.date = req.body.date;
        data.time = req.body.time;
        data.price = parseFloat(req.body.price);

        const order = new Order(data);

        await order.save();

        res.render('payment',{
    order,
    date:data.date,
    price:data.price
});

    } catch (err) {
        console.log(err);
        res.status(500).send('Order Processing Error');
    }
});

app.post('/pay', requireLogin, async (req,res)=>{

    try{

       const order = await Order.findOne({
    username:req.session.name
}).sort({createdAt:-1});

if(!order){
    return res.status(404).send("No order found");
}

res.render('confirmorder',{
    order
});

    }
    catch(err){
        console.log(err);
        res.status(500).send("Payment Error");
    }

});
app.post('/admin/status/:id', requireAdmin, async (req,res)=>{

    try{

        await Order.findByIdAndUpdate(
            req.params.id,
            {
                status:req.body.status
            }
        );

        res.redirect('/admin');

    }catch(err){

        console.log(err);

        res.status(500).send("Error");

    }

});
// ======================= Start Server =======================
const PORT = process.env.PORT || 3000;
app.get('/orderhistory', requireLogin, async (req,res)=>{

    const orders = await Order.find({
    username:req.session.name
}).sort({ createdAt: -1 });

    res.render('orderhistory',{
        orders
    });

});
app.get('/myorders', requireLogin, async (req, res) => {

    try {

        const orders = await Order.find({
            username: req.session.name
        }).sort({ createdAt: -1 });

        res.render('myorders', {
            orders
        });

    } catch (err) {

        console.log(err);

        res.status(500).send("Error");

    }

});

app.get('/admin', requireAdmin, async (req, res) => {

    try {

        const orders = await Order.find()
            .sort({ createdAt: -1 });

        res.render('admin', {
            orders
        });

    } catch (err) {

        console.log(err);

        res.status(500).send("Error");

    }

});

app.use((req,res)=>{
    res.status(404).send("Page Not Found");
});



app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});