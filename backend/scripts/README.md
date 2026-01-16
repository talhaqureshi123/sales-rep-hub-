# Database Seeding Scripts

## Seed Users Script

This script creates initial admin and salesman users in the database.

### Usage

```bash
# From the backend directory
npm run seed
# or
npm run seed:users
# or directly
node scripts/seedUsers.js
```

### What it does:

1. Connects to MongoDB database
2. Creates default users:
   - **Admin User**: admin@example.com / admin123
   - **Salesman 1**: salesman@example.com / salesman123
   - **John Salesman**: john.salesman@example.com / john123
   - **Sarah Salesman**: sarah.salesman@example.com / sarah123

3. Skips users that already exist (won't create duplicates)
4. Shows summary of all users in database

### Requirements:

- MongoDB connection must be configured in `enviornment/config.js`
- Backend dependencies must be installed (`npm install`)

### Notes:

- Passwords are automatically hashed using bcrypt
- All users are created with "Active" status
- The script is safe to run multiple times (won't create duplicates)

---

## Admin Manager Script

This script allows you to create, remove, or list admin users.

### Usage

**Create Admin:**
```bash
# Create admin with default email (talhaabid400@gmail.com)
npm run admin:create
# or
node scripts/adminManager.js create

# Create admin with custom email
node scripts/adminManager.js create your-email@gmail.com
```

**Remove Admin:**
```bash
npm run admin:remove your-email@gmail.com
# or
node scripts/adminManager.js remove your-email@gmail.com
```

**List All Admins:**
```bash
npm run admin:list
# or
node scripts/adminManager.js list
```

### Features:

1. **Create Admin**: Creates a new admin user with default password
2. **Remove Admin**: Removes an admin (prevents removing the last admin)
3. **List Admins**: Shows all admins in the system
4. **Auto-update**: If user with email already exists, updates to admin role

### Examples:

```bash
# Create admin with default email
node scripts/adminManager.js create

# Create admin with specific email
node scripts/adminManager.js create talhaabid400@gmail.com

# Remove an admin
node scripts/adminManager.js remove admin@example.com

# List all admins
node scripts/adminManager.js list
```

### Default Admin Credentials:

- **Email**: talhaabid400@gmail.com (or specified email)
- **Password**: Admin@123
- **Note**: Change password after first login!

### Security Notes:

- Default password is `Admin@123` - **change it after first login**
- Cannot remove the last admin in the system
- If user with email already exists, it will be updated to admin role

