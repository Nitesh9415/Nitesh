const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

const upload = multer({ storage: multer.memoryStorage() });

// 1. All products fetch
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add Product + Image
app.post('/api/products/add', upload.single('image'), async (req, res) => {
  try {
    const { title, category, specs, original_price, daily_price, admin_key } = req.body;

    if (admin_key !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: 'Galat Secret Key!' });
    }

    let imageUrl = '';

    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
    }

    const { data, error } = await supabase.from('products').insert([
      {
        title,
        category,
        specs,
        original_price: parseFloat(original_price) || null,
        daily_price: parseFloat(daily_price),
        image_url: imageUrl,
        in_stock: true
      }
    ]).select();

    if (error) throw error;
    res.json({ success: true, product: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update Price
app.put('/api/products/update-price/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { daily_price, in_stock, admin_key } = req.body;

    if (admin_key !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: 'Galat Secret Key!' });
    }

    const { data, error } = await supabase
      .from('products')
      .update({
        daily_price: parseFloat(daily_price),
        in_stock: in_stock,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, product: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});