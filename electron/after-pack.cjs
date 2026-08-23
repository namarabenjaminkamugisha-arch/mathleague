// after-pack.cjs — puts the MathLeague icon into MathLeague.exe ourselves.
//
// electron-builder would normally do this during its "sign and edit
// executable" step, but that step first extracts a `winCodeSign` bundle which
// contains macOS symlinks. Windows refuses to create symlinks unless the
// process is elevated or Developer Mode is on, so the extraction fails, the
// whole step is skipped, and the packaged exe silently keeps Electron's
// default atom icon - which is then what the desktop shortcut shows.
//
// Rather than require every build to run as administrator, we set the icon
// and version metadata directly with rcedit. Nothing here signs anything;
// there is no certificate, and the installer remains unsigned either way.

const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const { productFilename } = context.packager.appInfo;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');

  if (!fs.existsSync(exePath)) {
    throw new Error(`afterPack: expected ${exePath} to exist`);
  }
  if (!fs.existsSync(iconPath)) {
    throw new Error(`afterPack: icon missing at ${iconPath}`);
  }

  // The package exports a named `rcedit`, not a default.
  const { rcedit } = require('rcedit');
  const { version } = context.packager.appInfo;

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      ProductName: 'MathLeague',
      FileDescription: 'MathLeague',
      CompanyName: 'MathLeague',
      LegalCopyright: `Copyright (c) ${new Date().getFullYear()} Benjamin Namara Kamugisha`,
      OriginalFilename: `${productFilename}.exe`,
    },
    'file-version': version,
    'product-version': version,
  });

  console.log(`  • icon embedded    file=${productFilename}.exe`);
};
