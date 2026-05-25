"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const next_1 = __importDefault(require("next"));
const db_1 = __importDefault(require("./src/lib/db"));
const matching_1 = require("./src/lib/matching");
const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const hostname = 'localhost';
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
// Define a globally accessible socket server reference
exports.io = null;
app.prepare().then(async () => {
    const server = (0, express_1.default)();
    const httpServer = http_1.default.createServer(server);
    // Set up socket.io server
    exports.io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    // Attach socket server reference to the express app and global object
    server.set('io', exports.io);
    global.io = exports.io;
    exports.io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        // Join room for a specific market
        socket.on('join_market', async (marketId) => {
            const mId = parseInt(marketId, 10);
            if (!isNaN(mId)) {
                socket.join(`market_${mId}`);
                console.log(`Socket ${socket.id} joined market room: market_${mId}`);
                // Push initial market state immediately to the newly joined client
                try {
                    await (0, matching_1.broadcastMarketUpdates)(mId, exports.io);
                }
                catch (err) {
                    console.error(`Error sending initial market update:`, err);
                }
            }
        });
        // Leave room for a specific market
        socket.on('leave_market', (marketId) => {
            const mId = parseInt(marketId, 10);
            if (!isNaN(mId)) {
                socket.leave(`market_${mId}`);
                console.log(`Socket ${socket.id} left market room: market_${mId}`);
            }
        });
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
    // Seed default prediction markets if none exist in the database
    try {
        const marketCount = await db_1.default.market.count();
        if (marketCount === 0) {
            console.log('Seeding default prediction markets...');
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            await db_1.default.market.createMany({
                data: [
                    {
                        title: 'Will SpaceX Starship orbit Earth in 2026?',
                        description: 'This market resolves to YES if SpaceX successfully achieves a full orbital flight of the Starship spacecraft, landing or soft-landing in the ocean, by December 31, 2026. Resolves based on official SpaceX public telemetry and announcement.',
                        category: 'Space',
                        expiresAt: nextYear
                    },
                    {
                        title: 'Will GPT-5 be announced by OpenAI before December 2026?',
                        description: 'This market resolves to YES if OpenAI officially announces its next-generation frontier model, named GPT-5 or equivalent successor model, before Dec 31, 2026. Resolves based on official OpenAI blog or press release.',
                        category: 'AI & Tech',
                        expiresAt: nextMonth
                    },
                    {
                        title: 'Will the US Fed lower interest rates below 4% in 2026?',
                        description: 'This market resolves to YES if the Federal Reserve sets the federal funds target rate to less than 4% at any point during 2026. Resolves based on official Federal Reserve Board announcements.',
                        category: 'Finance & Econ',
                        expiresAt: nextYear
                    },
                    {
                        title: 'Will a human land on the Moon in Artemis II or III in 2026?',
                        description: 'This market resolves to YES if NASA launches and completes Artemis III with a crewed landing on the Moon before Jan 1, 2027. Resolves based on official NASA mission reports.',
                        category: 'Space',
                        expiresAt: nextYear
                    }
                ]
            });
            console.log('Default markets seeded successfully.');
        }
    }
    catch (error) {
        console.error('Error seeding initial markets:', error);
    }
    // NextAuth and standard API endpoints are handled by NextJS
    server.all('*', (req, res) => {
        return handle(req, res);
    });
    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
}).catch((err) => {
    console.error('Error preparing Next.js application:', err);
    process.exit(1);
});
