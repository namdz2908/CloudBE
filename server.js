require("dotenv").config( { quiet: true } );
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware 
app.use(cors());
app.use(express.json());

// Schema MongoDB
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Ten khong duoc de trong"],
        minlength: [2, "Ten phai co it nhat 2 ki tu"],
        trim: true // Chuẩn hóa: loại bỏ khoảng trắng
    },
    age: {
        type: Number,
        required: [true, "Tuoi khong duoc de trong"],
        min: [0, "Tuoi phai >= 0"],
        set: v => Math.floor(v) // Chuẩn hóa: Tuổi là số nguyên
    },
    email: {
        type: String,
        required: [true, "Email khong duoc de trong"],
        unique: true, // Chuẩn hóa: email duy nhất
        match: [/^\S+@\S+\.\S+$/, "Email khong hop le"],
        trim: true,
        lowercase: true
    },
    address: {
        type: String,
        trim: true
    }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

/* CÁC API quản lý người dùng */

// 1. GET - Lấy danh sách với phân trang và tìm kiếm
app.get('/api/users', async (req, res) => {
    try {
        // Giới hạn page/limit: Tránh page < 1 hoặc limit quá lớn (image_70d987.png)
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 5;
        if (page < 1) page = 1;
        if (limit > 100) limit = 100;

        const search = req.query.search || "";
        const skip = (page - 1) * limit;

        const query = {
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { address: { $regex: search, $options: "i" } }
            ]
        };

        // Sử dụng Promise.all cho truy vấn song song (image_70d987.png)
        const [users, total] = await Promise.all([
            User.find(query)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            User.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            page,
            limit,
            total,
            totalPages,
            data: users
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi Server", error: error.message });
    }
});

// 2. CREATE - Thêm người dùng mới
app.post('/api/users', async (req, res) => {
    try {
        const { name, age, email, address } = req.body;

        // Kiểm tra email duy nhất trước khi tạo
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email đã tồn tại" });
        }

        const newUser = new User({ name, age, email, address });
        const savedUser = await newUser.save();

        res.status(201).json({
            message: "Tạo người dùng thành công",
            data: savedUser
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 3. UPDATE - Chỉ cập nhật các trường được truyền vào (image_70d987.png)
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Kiểm tra ID hợp lệ
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID không hợp lệ" });
        }

        // Lọc bỏ các trường undefined/null để tránh ghi đè dữ liệu trống
        const updateData = {};
        const allowedFields = ['name', 'age', 'email', 'address'];

        Object.keys(req.body).forEach(key => {
            if (allowedFields.includes(key) && req.body[key] !== null && req.body[key] !== undefined) {
                updateData[key] = req.body[key];
            }
        });

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "Không tìm thấy người dùng" });
        }

        res.status(200).json({
            message: "Cập nhật thành công",
            data: updatedUser
        });
    } catch (error) {
        res.status(400).json({ message: "Lỗi cập nhật", error: error.message });
    }
});

// 4. DELETE - Xóa người dùng (Kiểm tra ID trước khi xóa)
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Chuẩn hóa: ID hợp lệ trước khi xóa (image_70d987.png)
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID không hợp lệ" });
        }

        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ message: "Không tìm thấy người dùng" });
        }
        res.status(200).json({ message: "Xóa người dùng thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi xóa", error: error.message });
    }
});

// --- Kết nối MongoDB và khởi động server ---
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("Connected to MongoDB successfully");
        app.listen(PORT, () => console.log(`API running on port ${PORT}`));
    })
    .catch((err) => {
        console.error("Connection Error:", err);
        process.exit(1);
    });