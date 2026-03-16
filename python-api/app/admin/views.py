from sqladmin import ModelView
from app.models.org import Store, Department
from app.models.user import User

class UserAdmin(ModelView, model=User):
    name = "User Accounts"
    name_plural = "User Accounts"
    column_list = [User.id, User.name, User.email, User.role, User.is_active, User.department_id]
    column_searchable_list = [User.name, User.email]
    column_sortable_list = [User.id, User.is_active, User.role]
    
    # Fields to show in the create/edit forms
    form_columns = [
        User.name, 
        User.email, 
        User.role, 
        User.is_active, 
        User.department, 
        User.stores
    ]
    icon = "fa-solid fa-address-card"

class StoreAdmin(ModelView, model=Store):
    column_list = [Store.id, Store.name, Store.code, Store.is_active]
    form_columns = [Store.name, Store.code, Store.is_active]
    icon = "fa-solid fa-shop"

class DepartmentAdmin(ModelView, model=Department):
    column_list = [Department.id, Department.name, Department.code, Department.is_active]
    form_columns = [Department.name, Department.code, Department.is_active]
    icon = "fa-solid fa-building"
