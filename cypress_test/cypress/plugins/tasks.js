const fs = require('fs');

const copyFile = args =>
  new Promise(resolve => {
    var source_file = args.source_dir + args.file_name
    var dest_file = args.dest_dir + args.file_name

    if (fs.existsSync(source_file)) {
      fs.mkdirSync(args.dest_dir, { recursive: true });
      fs.writeFileSync(dest_file, fs.readFileSync(source_file));
      resolve(`File ${source_file} copied to ${dest_file}`);
    }
    resolve(`File ${source_file} does not exist`);
  });

module.exports = { copyFile };
