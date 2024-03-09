'use strict'
import express from 'express';
import logger from 'morgan';
import { Server } from 'socket.io';
import { createServer } from 'node:http'
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config();

const port = process.env.PORT ?? 3000;

const app = express();

const server = createServer(app);

const db = createClient({
    url: `libsql://driving-blue-marvel-carlosmares.turso.io`,
    authToken: process.env.DB_TOKEN,
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        username TEXT
    )
`)

const io = new Server(server,{
    connectionStateRecovery: {
    }
});

io.on("connection", async (socket)=>{
    console.log('a user has connected');

    socket.on('disconnect', ()=>{
        console.log('a user has desconnecteds')
    })

    socket.on('chat message', async (msg)=>{
        let result
        const user = socket.handshake.auth.username ?? 'anonimo';
        try{
            result = await db.execute({
                sql: `INSERT INTO messages (content, username) VALUES (:content, :username)`,
                args: { content: msg , username: user}
            })
        }
        catch (e){
            console.error(e);
            return;
        }
        io.emit('chat message', msg, result.lastInsertRowid.toString(), user);
    })
    if(!socket.recovered){
        try{
            const result = await db.execute({
                sql: `SELECT id, content, username FROM messages WHERE id > ?`,
                args: [
                    socket.handshake.auth.serverOffset ?? 0 
                ]
            })
            result.rows.forEach(row =>{
                socket.emit('chat message', row.content, row.id.toString(), row.username);
            })
        }
        catch(e){
            console.error(e);
            return;
        }
    }
})

app.use(logger('dev'))

import RateLimit from 'express-rate-limit';

var limiter = RateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
});

app.use(limiter);

app.get("/", (req, res)=>{
    const path = process.cwd() + `/client/index.html`;
    // if(isValidPath(path)){
        res.sendFile(path);
    // }
})

server.listen(port, (err)=>{
    if(err){
        console.error(err);
    }
    console.log(`Server running on port ${port}`);
})