const { DataTypes } = require('sequelize');
const { database } = require('../settings');
const fs = require('fs-extra');
const path = require('path');

// Define sticker commands table
const StickerCmdDB = database.define('stickercmd', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    session_id: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'main'
    },
    sticker_hash: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    command: {
        type: DataTypes.STRING,
        allowNull: false
    },
    set_by: {
        type: DataTypes.STRING,
        allowNull: false
    },
    set_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    usage_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    last_used: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: true
});

// For file-based storage backup (optional)
const DATA_DIR = path.join(__dirname, '..', 'data', 'sticker-commands');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
async function initStickerCmdDB() {
    try {
        await StickerCmdDB.sync({ alter: true });
        console.log('StickerCmd table ready');
    } catch (error) {
        console.error('Error initializing StickerCmd table:', error);
        throw error;
    }
}

// Helper to get file path for JSON backup
function getSessionFile(sessionId = 'main') {
    return path.join(DATA_DIR, `${sessionId}.json`);
}

// Get sticker hash from message
function getStickerHash(stickerMsg) {
    try {
        const fileHash = stickerMsg?.fileSha256;
        if (!fileHash) return null;
        return Buffer.from(fileHash).toString('hex');
    } catch (error) {
        console.error('Error getting sticker hash:', error);
        return null;
    }
}

// Set sticker command
async function setStickerCommand(sessionId, stickerHash, command, userId) {
    try {
        sessionId = sessionId || 'main';
        
        // Save to database
        const [stickerCmd, created] = await StickerCmdDB.findOrCreate({
            where: { sticker_hash: stickerHash },
            defaults: {
                session_id: sessionId,
                sticker_hash: stickerHash,
                command: command,
                set_by: userId,
                set_at: new Date()
            }
        });

        if (!created) {
            // Update existing
            await stickerCmd.update({
                command: command,
                set_by: userId,
                set_at: new Date()
            });
        }

        // Also save to JSON file as backup
        try {
            const filePath = getSessionFile(sessionId);
            let fileData = {};
            
            if (fs.existsSync(filePath)) {
                fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
            
            fileData[stickerHash] = {
                command: command,
                setBy: userId,
                setAt: new Date().toISOString()
            };
            
            fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
        } catch (fileError) {
            console.error('Error saving to JSON backup:', fileError);
        }

        return true;
    } catch (error) {
        console.error('Error saving sticker command:', error);
        return false;
    }
}

// Get sticker command
async function getStickerCommand(sessionId, stickerHash) {
    try {
        sessionId = sessionId || 'main';
        
        // Try database first
        const stickerCmd = await StickerCmdDB.findOne({
            where: { 
                session_id: sessionId,
                sticker_hash: stickerHash 
            }
        });

        if (stickerCmd) {
            // Update usage count
            await stickerCmd.update({
                usage_count: stickerCmd.usage_count + 1,
                last_used: new Date()
            });
            
            return {
                command: stickerCmd.command,
                setBy: stickerCmd.set_by,
                setAt: stickerCmd.set_at,
                usageCount: stickerCmd.usage_count
            };
        }

        // Fallback to JSON file
        try {
            const filePath = getSessionFile(sessionId);
            if (!fs.existsSync(filePath)) return null;
            
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const fileCmd = fileData[stickerHash];
            
            if (fileCmd) {
                // Sync to database
                await setStickerCommand(sessionId, stickerHash, fileCmd.command, fileCmd.setBy);
                return fileCmd;
            }
        } catch (fileError) {
            console.error('Error reading from JSON backup:', fileError);
        }

        return null;
    } catch (error) {
        console.error('Error getting sticker command:', error);
        return null;
    }
}

// Remove sticker command
async function removeStickerCommand(sessionId, stickerHash) {
    try {
        sessionId = sessionId || 'main';
        
        // Remove from database
        const deleted = await StickerCmdDB.destroy({
            where: { 
                session_id: sessionId,
                sticker_hash: stickerHash 
            }
        });

        // Remove from JSON file
        try {
            const filePath = getSessionFile(sessionId);
            if (fs.existsSync(filePath)) {
                const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                delete fileData[stickerHash];
                fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
            }
        } catch (fileError) {
            console.error('Error removing from JSON backup:', fileError);
        }

        return deleted > 0;
    } catch (error) {
        console.error('Error removing sticker command:', error);
        return false;
    }
}

// Get all sticker commands for a user
async function getUserStickerCommands(sessionId, userId) {
    try {
        sessionId = sessionId || 'main';
        
        const commands = await StickerCmdDB.findAll({
            where: { 
                session_id: sessionId,
                set_by: userId 
            },
            order: [['set_at', 'DESC']]
        });

        return commands.map(cmd => ({
            hash: cmd.sticker_hash,
            command: cmd.command,
            setBy: cmd.set_by,
            setAt: cmd.set_at,
            usageCount: cmd.usage_count,
            lastUsed: cmd.last_used
        }));
    } catch (error) {
        console.error('Error getting user sticker commands:', error);
        return [];
    }
}

// Get all sticker commands (for listing)
async function getAllStickerCommands(sessionId) {
    try {
        sessionId = sessionId || 'main';
        
        const commands = await StickerCmdDB.findAll({
            where: { session_id: sessionId },
            order: [['usage_count', 'DESC']]
        });

        return commands.map(cmd => ({
            hash: cmd.sticker_hash,
            command: cmd.command,
            setBy: cmd.set_by,
            setAt: cmd.set_at,
            usageCount: cmd.usage_count
        }));
    } catch (error) {
        console.error('Error getting all sticker commands:', error);
        return [];
    }
}

// Increment usage count
async function incrementStickerUsage(stickerHash) {
    try {
        const stickerCmd = await StickerCmdDB.findOne({
            where: { sticker_hash: stickerHash }
        });

        if (stickerCmd) {
            await stickerCmd.update({
                usage_count: stickerCmd.usage_count + 1,
                last_used: new Date()
            });
        }
    } catch (error) {
        console.error('Error incrementing sticker usage:', error);
    }
}

// Initialize database
initStickerCmdDB().catch(err => {
    console.error('❌ Failed to initialize StickerCmd database:', err);
});

module.exports = {
    initStickerCmdDB,
    getStickerHash,
    setStickerCommand,
    getStickerCommand,
    removeStickerCommand,
    getUserStickerCommands,
    getAllStickerCommands,
    incrementStickerUsage,
    StickerCmdDB
};
