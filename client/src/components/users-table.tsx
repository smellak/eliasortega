import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { RoleBadge } from "./role-badge";
import type { UserResponse, UserRole } from "@shared/types";

interface UsersTableProps {
  users: UserResponse[];
  onAdd: (user: { email: string; password: string; role: UserRole }) => void;
  onEdit: (id: string, user: { email?: string; role?: string }) => void;
  onDelete: (id: string) => void;
}

export function UsersTable({ users, onAdd, onEdit, onDelete }: UsersTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<{ email: string; role: UserRole; password?: string }>({
    email: "",
    role: "BASIC_READONLY",
    password: "",
  });

  const handleSave = () => {
    if (editingId) {
      onEdit(editingId, { email: formData.email, role: formData.role });
      setEditingId(null);
    } else {
      onAdd({ email: formData.email, role: formData.role, password: formData.password || "" });
      setIsAdding(false);
    }
    resetForm();
  };

  const handleEdit = (user: UserResponse) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      role: user.role,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      email: "",
      role: "BASIC_READONLY",
      password: "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsAdding(true)} disabled={isAdding} data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="border border-border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {isAdding && <TableHead>Password</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAdding && (
              <TableRow>
                <TableCell>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="input-new-user-email"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={formData.role}
                    onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger data-testid="select-new-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="planner">Planner</SelectItem>
                      <SelectItem value="basic_readonly">View Only</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    data-testid="input-new-user-password"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={handleSave} data-testid="button-save-new-user">
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={handleCancel} data-testid="button-cancel-new-user">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {users.map((user) => (
              <TableRow key={user.id}>
                {editingId === user.id ? (
                  <>
                    <TableCell>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={formData.role}
                        onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="planner">Planner</SelectItem>
                          <SelectItem value="basic_readonly">View Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={handleSave}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={handleCancel}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDelete(user.id)}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}

            {users.length === 0 && !isAdding && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No users yet. Click "Add User" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
