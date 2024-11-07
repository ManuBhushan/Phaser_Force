import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import passport from 'passport';
import cors from 'cors';
import { PrismaClient, User } from '@prisma/client'; // Import Prisma Client
import bcrypt from "bcrypt";
import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import jwt from "jsonwebtoken";
import { createServer } from 'http';
import { Server } from 'socket.io';
dotenv.config();

const app = express();
const prisma = new PrismaClient(); // Create a Prisma Client instance



app.use(express.json());

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));


const httpserver=createServer(app);

const io=new Server(httpserver,{
    cors:{
        origin:"http://localhost:5173",
        credentials:true,
        methods:["GET","POST"]
    }
});


io.on('connection',(socket)=>{
    console.log("SOcket connected with userId: ",socket.id);

    socket.on("level-comp",(data)=>{
        console.log("FROM SOCKET : ",data);
    })
})

app.use(session({
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID || "",
    clientSecret: process.env.CLIENT_SECRET || "",
    callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await prisma.user.findFirst({
            where: { googleID: profile.id }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    googleID: profile.id,
                    name: profile.displayName,
                    email: profile.emails?.[0]?.value || "",
                    photo: profile.photos?.[0]?.value || "",
                    verified: true
                }
            });
        }

        return done(null, user  );
    } catch (error) {
        return done(error, undefined);
    }
}));


passport.serializeUser((user , done) => {
    done(null, user );
});

passport.deserializeUser((user : User, done) => {
    done(null, user );
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req , res: Response) => {
        if (req.user) {
            const user = req.user as User;
            const verified = user.verified;
            const id=user.id;
            const ID=jwt.sign({id} ,process.env.JWT_SECRET || ""); //use  id instead of verified later for more security 
            const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET || "");
            res.redirect(`http://localhost:5173/play?verified=${encodeURIComponent(token)}&userName=${encodeURIComponent(user.name)}`);
        } else {
            res.redirect('/'); // Handle the case where user is undefined
        }
    }
);

app.get('/', (req, res) => {
    res.send("Error while signing In");
});


interface CustomRequest extends Request {
    userId?: { id: number };
    userName?:{name:string};
}


 const checkUser=(req: CustomRequest, res: Response, next: NextFunction)=>{
    try{
       
    const token=req.headers.authorization || "";
    console.log("T: ",token);
    const user=jwt.verify(token,process.env.JWT_SECRET || "") as { id: number, name:string } ;
    if(!user){
             res.status(409).send("Invalid user");
             return ;
    }
    else{       
        const id:number=user.id;
        const name:string =user.name;
        const userId={id};
        const userName={name};
        req.userName=userName;
        req.userId=userId;  
        console.log("NEXT: ");
        next();
        }
    }
    catch(e){
         res.status(411).send("Wrong user");
         return ;

    }
}
app.get('/auth', checkUser ,(req:CustomRequest, res:Response) => {
   res.send("valid user");
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'manubhushan1234@gmail.com',
        pass: process.env.EMAIL_SECRET // Use an App Password if 2FA is enabled
    }
});

app.get("/auth/verifyOtp/:otp", async (req, res) => {
    try {

        const otp = req.params.otp;
        const email = req.query.email as string; // Ensure email is of type string

        const user = await prisma.user.findUnique({
            where: { email: email }
        });

        if (!user) {
            res.status(400).send("Invalid User");
            return;
        }
        if (user.verificationCode === -1) {
            res.status(411).send("You have not logged in using verify otp");
            return;
        }
        if (Number(otp) !== user.verificationCode) {
            res.status(411).send("Wrong otp");
            return;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { verified: true }
        });

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email , Level:user.Level}, process.env.JWT_SECRET || "");
        res.status(200).send({ token: token });
    } catch (error) {
        res.status(411).send("error");
    }
});

app.post("/auth/signup", async (req, res) => {
    try {
        const { email, password, name } = req.body;
        let user = await prisma.user.findUnique({
            where: { email: email }
        });

        if (user) {
            res.status(400).send("User already Exist");
            return;
        }
        const otp = Math.floor(100000 + Math.random() * 900000);
        const mailOptions = {
            from: 'manubhushan1234@gmail.com',
            to: email,
            subject: 'Verification code for SignUp on Phaser Force',
            text: String(otp),
            html: String(otp),
        };

        await transporter.sendMail(mailOptions);
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await prisma.user.create({
            data: {
                name,
                password: hashedPassword,
                email,
                verificationCode: otp,
            }
        });

        
        res.status(200).send("Email sent successfully");
    } catch (e) {
        res.status(411).send("Error while signing Up");
    }
});

app.post("/auth/local", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            res.status(400).json({ message: "User not found" });
        } else {
            if (!user.password) {
                res.status(400).json({
                    message: "This email is registered via Google. Please use Google sign-in."
                });
                return;
            } else {
                if (!user.verified) {
                    const otp = Math.floor(100000 + Math.random() * 900000);
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { verificationCode: otp }
                    });
                   
                    const mailOptions = {
                        from: 'manubhushan1234@gmail.com',
                        to: email,
                        subject: 'Verification code for SignUp on Phaser Force',
                        text: String(otp),
                        html: String(otp),
                    };

                    await transporter.sendMail(mailOptions);
                    res.status(409).send("Your Email is not verified. Verify your email");
                    return;
                }
                const result = await bcrypt.compare(password, user.password);
                if (!result) {
                    res.status(411).json({ message: "Wrong password" });
                } else {
                    const token = jwt.sign({ id: user.id, name: user.name, email: user.email , Level:user.Level}, process.env.JWT_SECRET || "");
                    res.status(200).send({ token: token });
                }
            }
        }
    } catch (error) {
        res.status(411).send("Error while login user");
    }
});

    app.put("/newgame",checkUser,async(req:CustomRequest,res)=>{
        try {

            const userId=req.userId?.id   

            const user=await prisma.user.update({
                where:{
                id:Number(userId)
                },
                data:{
                    isCompleted:false,
                    x:800,
                    y:1550,
                    Level:"Level1",
                    levels:{
                        updateMany:{
                            where:{
                                userId:Number(userId)
                            },
                            data:{
                                SPI:0
                            }
                        }
                    }
                },select:{
                    x:true,
                    y:true,
                    isCompleted:true,
                    Level:true
                }
             
            })
            // do not change the CPI when the game will get comp take the avg of all the bestSPI and 
            // put CPI =  max(CPI ,  Avg of bestSPI )
            console.log(user);
            res.send(user);
            
            return ;
            
        } catch (error) {
                res.status(409).send("Error while making new game");
        }
    });


app.get("/resume",checkUser,async(req:CustomRequest,res)=>{
    try {
        const userId=req.userId?.id;    

        const user=await prisma.user.findFirst({
            where:{
                id:Number(userId)
            },
            select:{
                Level:true,
                x:true,
                y:true
            }
        })
        console.log("UUUUUU: ",user);
        res.send(user);
        return ;

    }
    catch(e){
        res.status(411).send("Error while fetching the current level");
        return ;
    }
});

app.get("/leaderboard",async(req,res)=>{
    try {
            const winners=await prisma.user.findMany({
                where:{
                    isCompleted:true,                    
                }
                , select:{
                    CPI:true,
                    name:true,
                },
                orderBy:{
                    CPI:'desc' // to get the highest cpi at the top
                }
            })
            console.log(winners);
            res.send(winners);
            return ;
    } catch (error) {
             res.status(400).send("Error while fetching winners");
             return ;
    }
});

app.get("/complevel",checkUser,async(req:CustomRequest,res:Response)=>{
    try{

        const userId=req.userId?.id;
        const level=await prisma.level.findMany({
            where:{
                userId
            },
            select:{
                levelName:true,
                isComp:true,
                bestSPI:true,
                SPI:true,

            }
        })
        console.log(level);
        res.send(level);
        return ;
    }
    catch(e){
        res.status(400).send("Error while fetching the completed levels");
        return;
         
    }
})

const PORT = process.env.PORT || 3000;
httpserver.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
