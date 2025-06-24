const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// Function to recursively find command files
function findCommands(directory) {
    const items = fs.readdirSync(directory);
    for (const item of items) {
        const itemPath = path.join(directory, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
            findCommands(itemPath); // Recurse into subdirectories
        } else if (item.endsWith('.js')) {
            const command = require(itemPath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] The command at ${itemPath} is missing a required "data" or "execute" property.`);
            }
        }
    }
}

findCommands(commandsPath);

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();