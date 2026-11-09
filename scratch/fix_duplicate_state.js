const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'utf8');

const sNorm = s.replace(/\r\n/g, '\n');

const duplicate = `  const [defaultOtpEmail, setDefaultOtpEmail] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [defaultOtpEmail, setDefaultOtpEmail] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);`;

const single = `  const [defaultOtpEmail, setDefaultOtpEmail] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);`;

const sFixed = sNorm.replace(duplicate, single).replace(/\n/g, '\r\n');

fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', sFixed, 'utf8');
console.log('Fixed duplicate state declaration in FolderCreation.jsx');

