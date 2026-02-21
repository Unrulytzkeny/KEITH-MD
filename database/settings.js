const { DataTypes } = require('sequelize');
const { 
  database, 
  botPrefix, 
  botAuthor, 
  botUrl, 
  botGurl, 
  botTimezone, 
  botBotname, 
  botPackname, 
  botMode, 
  botSessionName 
} = require('../settings'); 

const SettingsDB = database.define('settings', {
    prefix: {
        type: DataTypes.STRING,
        defaultValue: botPrefix,
        allowNull: false
    },
    author: {
        type: DataTypes.STRING,
        defaultValue: botAuthor,
        allowNull: false
    },
    url: {
        type: DataTypes.STRING,
        defaultValue: botUrl,
        allowNull: false
    },
    gurl: {
        type: DataTypes.STRING,
        defaultValue: botGurl,
        allowNull: false
    },
    timezone: {
        type: DataTypes.STRING,
        defaultValue: botTimezone,
        allowNull: false
    },
    botname: {
        type: DataTypes.STRING,
        defaultValue: botBotname,
        allowNull: false
    },
    packname: {
        type: DataTypes.STRING,
        defaultValue: botPackname,
        allowNull: false
    },
    mode: {
        type: DataTypes.STRING,
        defaultValue: botMode,
        allowNull: false
    },
    sessionName: {
        type: DataTypes.STRING,
        defaultValue: botSessionName,
        allowNull: false
    }
}, {
    timestamps: true,
    tableName: 'bot_settings'
});

async function initSettingsDB() {
    try {
        await SettingsDB.sync({ alter: true });
        console.log('Settings table ready');
        
        // Initialize with default values if empty
        const count = await SettingsDB.count();
        if (count === 0) {
            await SettingsDB.create({
                prefix: botPrefix,
                author: botAuthor,
                url: botUrl,
                gurl: botGurl,
                timezone: botTimezone,
                botname: botBotname,
                packname: botPackname,
                mode: botMode,
                sessionName: botSessionName
            });
            console.log('Bot settings defaults initialized from settings');
        }
    } catch (error) {
        console.error('Error initializing Settings table:', error);
        throw error;
    }
}

async function getSettings() {
    try {
        let settings = await SettingsDB.findOne();
        if (!settings) {
            settings = await SettingsDB.create({
                prefix: botPrefix,
                author: botAuthor,
                url: botUrl,
                gurl: botGurl,
                timezone: botTimezone,
                botname: botBotname,
                packname: botPackname,
                mode: botMode,
                sessionName: botSessionName
            });
        }
        return settings;
    } catch (error) {
        console.error('Error getting settings:', error);
        // Fallback to environment defaults
        return {
            prefix: botPrefix,
            author: botAuthor,
            url: botUrl,
            gurl: botGurl,
            timezone: botTimezone,
            botname: botBotname,
            packname: botPackname,
            mode: botMode,
            sessionName: botSessionName
        };
    }
}

async function updateSettings(updates) {
    try {
        const settings = await getSettings();
        return await settings.update(updates);
    } catch (error) {
        console.error('Error updating settings:', error);
        return null;
    }
}

async function getSetting(key) {
    try {
        const settings = await getSettings();
        return settings[key];
    } catch (error) {
        console.error(`Error getting setting ${key}:`, error);
        return null;
    }
}

module.exports = {
    initSettingsDB,
    getSettings,
    updateSettings,
    getSetting,
    SettingsDB
};
