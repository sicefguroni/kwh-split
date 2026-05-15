# KWH-Split Database Setup Guide

This PostgreSQL database schema implements an expense-splitting application that allows groups of users to track and split shared expenses.

## Database Schema Overview

The database consists of 8 main tables:

1. **users** - User account information
2. **groups** - Groups for organizing expenses
3. **group_members** - Junction table linking users to groups
4. **expensers** - Individual expenses within groups
5. **receipt_items** - Line items from receipts (optional)
6. **receipt_items_assignments** - Assignment of items to users
7. **expense_splits** - How expenses are split among users
8. **user_auth_providers** - Linked OAuth identities (Google)

## Setup Instructions

### Prerequisites
- PostgreSQL 12+ installed and running
- psql command-line tool or a PostgreSQL GUI client

### Step 1: Create the Database

```bash
createdb kwh_split
```

Or using psql:
```sql
CREATE DATABASE kwh_split;
```

### Step 2: Connect to the Database

```bash
psql -U postgres -d kwh_split
```

### Step 3: Load the Schema

Execute the schema.sql file to create all tables and indexes:

```bash
psql -U postgres -d kwh_split -f schema.sql
```

Or in psql:
```sql
\i schema.sql
```

### Step 4: Apply Migrations

The checked-in schema is only the base snapshot. Run the migration runner so later
auth and profile columns are present in your local database:

```bash
pnpm db:migrate
```

### Step 5: Load Sample Data (Optional)

To populate the database with sample data:

```bash
psql -U postgres -d kwh_split -f sample_data.sql
```

Or in psql:
```sql
\i sample_data.sql
```

## Database Tables

### Users Table
Stores user account information
- `user_id` (Primary Key)
- `name` - User's display name
- `email` - Unique email address
- `password` - Hashed password
- `is_active` - Account status
- `avatar_url` - Optional profile image URL
- `email_verified` - Optional email verification status from provider
- `profile_image_url` - Optional uploaded profile image URL
- `bank_qr_url` - Optional bank or wallet QR image URL
- `discount_type` - Discount category (`none`, `pwd`, `senior`)
- `created_at`, `updated_at` - Timestamps

### User Auth Providers Table
Stores social login identities linked to app users
- `auth_provider_id` (Primary Key)
- `user_id` (Foreign Key) - References users
- `provider` - Provider name (`google`)
- `provider_user_id` - Stable provider user identifier
- `provider_email` - Email returned by provider
- `created_at`, `updated_at` - Timestamps

### Groups Table
Stores group information for organizing expenses
- `group_id` (Primary Key)
- `name` - Group name
- `description` - Group description
- `currency` - Currency code (e.g., 'USD')
- `created_at`, `updated_at` - Timestamps

### Group Members Table
Junction table connecting users to groups with roles
- `member_id` (Primary Key)
- `group_id` (Foreign Key) - References groups
- `user_id` (Foreign Key) - References users
- `role` - Member role (admin, member, etc.)
- `created_at`, `updated_at` - Timestamps

### Expensers Table
Records individual expenses within groups
- `expense_id` (Primary Key)
- `group_id` (Foreign Key) - References groups
- `title_description` - Expense description
- `total_amount` - Total expense amount
- `sale_date` - Date of expense
- `tax_amount` - Tax amount (if applicable)
- `tip_amount` - Tip amount (if applicable)
- `split_type` - How to split ('equal', 'itemized', 'percentage', etc.)
- `receipt_items_flag` - Whether itemized receipt is used
- `receipt_image_url` - URL to receipt image
- `created_at`, `updated_at` - Timestamps

### Receipt Items Table
Line items from itemized receipts
- `item_id` (Primary Key)
- `expense_id` (Foreign Key) - References expensers
- `item_name` - Description of item
- `price` - Price of item
- `created_at`, `updated_at` - Timestamps

### Receipt Items Assignments Table
Assigns individual receipt items to users
- `assignment_id` (Primary Key)
- `item_id` (Foreign Key) - References receipt_items
- `user_id` (Foreign Key) - References users
- `created_at`, `updated_at` - Timestamps

### Expense Splits Table
Records how each expense is split among users
- `split_id` (Primary Key)
- `expense_id` (Foreign Key) - References expensers
- `user_id` (Foreign Key) - References users
- `amount_owed` - Amount owed by this user
- `percentage` - Percentage share
- `share` - Custom share amount (if applicable)
- `is_settled` - Whether this split has been paid
- `created_at`, `updated_at` - Timestamps

## Key Constraints

- **Foreign Keys**: All foreign keys have `ON DELETE CASCADE` to maintain referential integrity
- **Unique Constraints**: 
  - `users.email` - Email must be unique
  - `group_members` - Each user can only have one membership per group
  - `receipt_items_assignments` - Each user can only be assigned to an item once
  - `user_auth_providers` - One identity per provider account and one account per provider per user
- **Default Values**: Timestamps automatically set to current time

## Useful Queries

### Get all members of a group
```sql
SELECT u.name, gm.role 
FROM group_members gm
JOIN users u ON gm.user_id = u.user_id
WHERE gm.group_id = 1;
```

### Get total expenses for a group
```sql
SELECT SUM(total_amount) as total_expenses
FROM expensers
WHERE group_id = 1;
```

### Get amount owed by a user
```sql
SELECT u.name, SUM(es.amount_owed) as total_owed
FROM expense_splits es
JOIN users u ON es.user_id = u.user_id
WHERE u.user_id = 1 AND es.is_settled = false
GROUP BY u.user_id, u.name;
```

### Get all settled and unsettled splits
```sql
SELECT e.title_description, u.name, es.amount_owed, es.is_settled
FROM expense_splits es
JOIN expensers e ON es.expense_id = e.expense_id
JOIN users u ON es.user_id = u.user_id
WHERE e.group_id = 1;
```

## Notes

- All monetary amounts are stored as DECIMAL(10, 2) for precision
- Timestamps are automatically set to UTC
- The schema uses snake_case for table and column names (PostgreSQL convention)
- Indexes are created on all foreign keys and commonly queried fields for performance
