"""The permissions an admin role can grant. Keys are stable strings checked by the API and the web app."""

PERMISSIONS = [
    ('dashboard.view', 'Dashboard', 'See the dashboard numbers'),
    ('products.view', 'Products', 'See products, categories and styles'),
    ('products.manage', 'Products', 'Create, edit, hide and delete products'),
    ('catalog.manage', 'Catalog setup', 'Manage categories, styles and skin tone colour rules'),
    ('orders.view', 'Orders', 'See orders'),
    ('orders.manage', 'Orders', 'Change order status and delete orders'),
    ('bookings.view', 'Bookings', 'See bookings'),
    ('bookings.manage', 'Bookings', 'Update and delete bookings'),
    ('scans.view', 'Face scans', 'See face scan records'),
    ('team.manage', 'Team', 'Add, edit and remove team members and roles'),
]

PERMISSION_KEYS = [key for key, _, _ in PERMISSIONS]
ALL = '*'

# Roles created by the first migration. Super Admin is a system role: it always has every permission
# and cannot be edited or deleted, so the panel can never be left without someone who can manage the team.
DEFAULT_ROLES = [
    {
        'slug': 'super-admin', 'name': 'Super Admin', 'is_system': True, 'permissions': [ALL],
        'description': 'Full access, including the team and roles.',
    },
    {
        'slug': 'manager', 'name': 'Manager', 'is_system': False,
        'permissions': ['dashboard.view', 'products.view', 'products.manage', 'catalog.manage', 'orders.view',
                        'orders.manage', 'bookings.view', 'bookings.manage', 'scans.view'],
        'description': 'Runs the shop day to day. Everything except the team.',
    },
    {
        'slug': 'inventory-staff', 'name': 'Inventory Staff', 'is_system': False,
        'permissions': ['dashboard.view', 'products.view', 'products.manage', 'catalog.manage'],
        'description': 'Keeps the catalog and stock up to date.',
    },
    {
        'slug': 'order-handler', 'name': 'Order Handler', 'is_system': False,
        'permissions': ['dashboard.view', 'products.view', 'orders.view', 'orders.manage', 'bookings.view', 'bookings.manage'],
        'description': 'Processes orders and bookings.',
    },
]


def expand(permissions):
    """A role's stored permissions as the full list of keys ('*' means all of them)."""
    if ALL in (permissions or []):
        return list(PERMISSION_KEYS)
    return [key for key in PERMISSION_KEYS if key in (permissions or [])]
