const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.static('public'));
app.use(express.json());

// Funciones auxiliares
const authenticateUser = async () => {
    try {
        const response = await axios.post('https://db.conectavet.cl:8080/api/collections/users/auth-with-password', {
            identity: 'admin@email.com',
            password: 'admin1234'
        });

        if (response && response.data) {
            return response.data;
        } else {
            throw new Error('No se recibió una respuesta válida de autenticación');
        }
    } catch (error) {
        console.error('Error en la autenticación:', error.response ? error.response.data : error.message);
        throw new Error('No se pudo autenticar el usuario');
    }
};

const getUsers = async (authData) => {
    try {
        const { token, record } = authData;
        let queryParam = `id=${record.id}`;
        if (record.type === 'admin') {
            queryParam = '';
        }

        const response = await axios.get(`https://db.conectavet.cl:8080/api/collections/users/records?${queryParam}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response && response.data && response.data.items) {
            return response.data.items;
        } else {
            throw new Error('No se recibieron datos válidos al obtener usuarios');
        }
    } catch (error) {
        console.error('Error al obtener usuarios:', error.response ? error.response.data : error.message);
        throw new Error('No se pudieron obtener los usuarios');
    }
};

const getRatingsBySpecialist = async (idMember) => {
    try {
        const response = await axios.get(`https://db.conectavet.cl:8080/api/collections/ratings/records?filter=(idMember='${idMember}')`);
        return response.data.items;
    } catch (error) {
        console.error('Error al obtener valoraciones:', error.response ? error.response.data : error.message);
        throw new Error('No se pudieron obtener las valoraciones');
    }
};

const processRatings = (ratings) => {
    if (!ratings.length) {
        return {
            average: 0,
            totalRatings: 0,
            ratingDistribution: {},
            comments: []
        };
    }

    const average = ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length;
    
    const ratingDistribution = ratings.reduce((acc, curr) => {
        acc[curr.rating] = (acc[curr.rating] || 0) + 1;
        return acc;
    }, {});
    
    const comments = ratings
        .filter(rating => rating.comment)
        .map(rating => ({
            comment: rating.comment,
            idUser: rating.idUser
        }));

    return {
        average: Number(average.toFixed(2)),
        totalRatings: ratings.length,
        ratingDistribution,
        comments
    };
};

// Rutas
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

app.get('/ratings/:idMember', async (req, res) => {
    const { idMember } = req.params;
    try {
        const ratings = await getRatingsBySpecialist(idMember);
        const processedData = processRatings(ratings);
        res.json(processedData);
    } catch (error) {
        console.error('Error al obtener valoraciones:', error);
        res.status(500).json({ error: 'Error al obtener las valoraciones' });
    }
});

app.post('/ratings/:idMember', async (req, res) => {
    const { idMember } = req.params;
    const { rating, comment, idUser } = req.body;
    
    try {
        const response = await axios.post('https://db.conectavet.cl:8080/api/collections/ratings/records', {
            idMember,
            idUser,
            rating: Number(rating),
            comment,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error al crear valoración:', error);
        res.status(500).json({ error: 'Error al crear la valoración' });
    }
});

// Ruta catch-all (opcional)
app.get('*', (req, res) => {
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
