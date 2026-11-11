import { removeBackground } from '@imgly/background-removal-node';
import fs from 'fs';
const blob = await removeBackground('file://' + process.cwd() + '/photo.png', { model: 'medium', output: { format: 'image/png', quality: 1 } });
fs.writeFileSync('cut.png', Buffer.from(await blob.arrayBuffer()));
console.log('done');
