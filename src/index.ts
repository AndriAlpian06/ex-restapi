import express, { Express, NextFunction, Request, Response } from "express";
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import multer, { StorageEngine } from 'multer';
// const cors = require('cors');

const app = express();
const PORT = 8000;
const prisma = new PrismaClient();

// app.use(cors())
app.use(express.json())

interface UserData {
    id: string;
    name: string;
    address: string;
}

interface ValidationRequest extends Request {
    userData: UserData
}

const accessValidation = (req: Request, res: Response, next: NextFunction) => {
    const validationReq = req as ValidationRequest
    const { authorization } = validationReq.headers;

    if(!authorization){
        return res.status(401).json({
            message: 'token diperlukan'
        })
    }

    const token = authorization.split(' ')[1];
    const secret = process.env.JWT_SECRET!;

    try{
        const jwtDecode = jwt.verify(token, secret)
        
        if(typeof jwtDecode !== 'string'){
            validationReq.userData = jwtDecode as UserData
        }
    } catch (error) {
        return res.status(401).json({
            message: 'Unauthorized'
        })
    }
    next()
}

// REGISTER
app.use('/register', async (req, res) => {
    const {name, email, password} = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await prisma.users.create({
        data: {
            name,
            email,
            password: hashedPassword,
        }
    })

    res.json({
        message: 'user created'
    })
})

// LOGIN
app.use('/login', async (req, res) => {
    const { email, password } = req.body

    if(email == null) throw new Error('email undefined');

    const user = await prisma.users.findUnique({
        where: {
            email: email
        }
    })

    if(!user){
        return res.status(404).json({
            message: 'User not found'
        })
    }

    if(!user.password){
        return res.status(404).json({
            message: 'Password not found'
        })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if(isPasswordValid){
        const payload = {
            id: user.id,
            name: user.name,
            address: user.address
        }
        
        const secret = process.env.JWT_SECRET!;

        const expiresIn = 60 * 60 * 1;

        const token = jwt.sign(payload, secret, {expiresIn: expiresIn})
        
        return res.json({
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                address: user.address
            },
            token: token
        })
    }else{
       return res.status(404).json({
        message: 'Wrong password'
       }) 
    }
})

// CREATE
app.post('/users', async (req, res, next) => {
    const { name, email, address } = req.body;

    const result = await prisma.users.create({
        data: {
            name: name,
            email: email,
            address: address
        }
    })
    res.json({
        data: result,
        message: 'User created'
    })
})

// READ
app.get('/users', accessValidation, async (req, res) => {
    const result = await prisma.users.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            address: true,
        }
    });
    res.json({
        data: result,
        message: 'User lists'
    })
})

// UPDATE
app.patch('/users/:id', async (req, res) => {
    const {id} = req.params;
    const { name, email, address } = req.body

    const result = await prisma.users.update({
        data: {
            name: name,
            email: email,
            address: address,
        },
        where: {
            id: Number(id)
        }
    })
    
    res.json({
        data: result,
        message: `User ${id} updated`
    })
})

// DELETE
app.delete('/users/:id', async (req, res) => {
    const {id} = req.params;

    const result = await prisma.users.delete({
        where: {
            id: Number(id)
        }
    })

    res.json({
        message: `User ${id} deleted`
    })
})

const storage: StorageEngine = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });

const upload = multer({ storage: storage})

app.post('/branding', upload.single('image'), async (req: Request, res: Response) => {
    try{
        const { name, category } = req.body
        
        if (req.file?.path) {
            const imgPath = req.file.path
        
            const result = await prisma.branding.create({
                data: {
                    name: name,
                    category: category,
                    image: imgPath
                },
            })

            res.json({
                data: result,
                message: 'Gambar berhasil diunggah dan data merek dibuat'
            });
        } else {
            // Handle kasus ketika req.file tidak ada
            res.status(400).json({ message: 'Tidak ada berkas yang diunggah' });
        
        }
    } catch (error){
        console.log('Error creating branding:', error)
        res.status(500).json({
            message: 'Terjadi kesalahan server',
        })
    }
})

// ADD BRANDING
// app.post('/branding', async (req, res) => {
//     const dataImage = req.body

//     const result = await prisma.branding.create({
//         data: {
//             name: dataImage.name,
//             category: dataImage.category,
//             image: dataImage.image,
//         }
//     })

//     res.json({
//         data: result,
//         message: 'image created'
//     })
// })

// READ BRANDING
app.get('/branding', async (req, res) => {
    const dataBranding = await prisma.branding.findMany({
        select: {
            id: true,
            name: true,
            category: true,
            image: true,
        }
    })

    res.json({
        data: dataBranding,
        message: 'List Data Branding'
    })
})

// Detail BRANDING
app.get('/branding/:id', async (req, res) => {
    const {id} = req.params
    try{
        const brandingDetail = await prisma.branding.findMany({
            where: { id: parseInt(id) },
            select: {
                id: true,
                name: true,
                category: true,
                image: true,
            }
        })

        if (!brandingDetail) {
            return res.status(404).json({
                message: 'Merek tidak ditemukan'
            });
        }

        res.json({
            data: brandingDetail,
            message: 'List Data Branding'
        })
    } catch (error) {
        console.error('Error fetching branding detail:', error);
        res.status(500).json({
            message: 'Terjadi kesalahan server'
        });
    }
})

// UPDATE BRANDING
// app.patch('/branding/:id', async (req, res) => {
//     const {id} = req.params
//     const {name, category, image } = req.body

//     const result = await prisma.branding.update({
//         data: {
//             name: name,
//             category: category,
//             image: image,
//         },
//         where : {
//             id: Number(id)
//         }
//     })

//     res.json({
//         data: result,
//         message: 'branding is updated'
//     })
// })
app.put('/branding/:id', upload.single('image'), async (req, res) => {
    try{
        const {id} = req.params
        const { name, category } = req.body
        const imgPath = req.file?.path

        // Validasi data, contoh: memeriksa apakah ID merek ada dalam database
        const existingImg = await prisma.branding.findUnique({
            where: {
                id: parseInt(id)
            }
        })

        if(!existingImg){
            return res.status(404).json({
                message: 'Branding tidak ditemukan'
            })
        }

        const updateData = {
            name: name || existingImg.name,
            category: category || existingImg.category,
            image: imgPath || existingImg.image
        }

        const updateBranding = await prisma.branding.update({
          where: {
            id: parseInt(id)
          },
          data: updateData  
        })

        res.json({
            message: 'Merek berhasil diedit',
            data: updateBranding
        })
    } catch (error){
        console.log('Error editing branding:', error)
        res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
})

// DELETE BRANDING
app.delete('/branding/:id', async (req, res) => {
    const {id} = req.params

    const result = await prisma.branding.delete({
        where: {
            id: Number(id)
        }
    })

    res.json({
        message: `Branding ${id} deleted`
    })
})
app.listen(PORT, () => {
    console.log(`Server Running in PORT: ${PORT}`)
})