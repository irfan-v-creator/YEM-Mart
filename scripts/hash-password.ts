import readline from 'readline';
import * as argon2 from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

async function main() {
  const passwordArg = process.argv[2];
  let password = passwordArg;

  if (!password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    password = await new Promise<string>((resolve) => {
      rl.question('Enter Admin Password to hash: ', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });
  }

  if (!password) {
    console.error('Password cannot be empty.');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('🔐 YEM MART Admin Password Hash Generator');
  console.log('========================================\n');

  // Generate Argon2id hash (Recommended, default algorithm in @node-rs/argon2)
  const argon2Hash = await argon2.hash(password);

  // Generate bcrypt hash (12 rounds)
  const bcryptHash = await bcrypt.hash(password, 12);

  console.log('Option 1: Argon2id Hash (Recommended):');
  console.log(`ADMIN_PASSWORD_HASH="${argon2Hash}"\n`);

  console.log('Option 2: Bcrypt Hash (12 rounds):');
  console.log(`ADMIN_PASSWORD_HASH="${bcryptHash}"\n`);

  console.log('----------------------------------------');
  console.log('Instructions:');
  console.log('1. Copy ONE of the ADMIN_PASSWORD_HASH lines above.');
  console.log('2. In your Vercel Dashboard -> Settings -> Environment Variables, add:');
  console.log('   Key: ADMIN_PASSWORD_HASH');
  console.log('   Value: <the hash starting with $argon2id$ or $2b$>');
  console.log('3. Remove or clear the legacy plain-text ADMIN_PASSWORD variable.');
  console.log('4. Redeploy your app.\n');
}

main().catch(console.error);
