export interface User {
  id: number;
  clerkId: string | null;
  nombre: string;
  email: string;
  rolId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserInput = {
  clerkId?: string | null;
  nombre: string;
  email: string;
  rolId?: number | null;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'email' | 'nombre'>> & {
  // permitir actualizar nombre/email si se requiere: los exponemos como opcionales
  nombre?: string;
  email?: string;
  rolId?: number | null;
  clerkId?: string | null;
};
