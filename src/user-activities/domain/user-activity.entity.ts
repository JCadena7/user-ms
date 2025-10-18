// Tipos de actividades basados en la BD
export type UserActivityType = 
  | 'post_created' 
  | 'post_published' 
  | 'comment_added'
  | 'profile_updated' 
  | 'follow' 
  | 'like_given';

export interface UserActivity {
  id: string; // UUID
  userId: number;
  type: UserActivityType;
  description: string;
  target: string | null;
  content: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export type CreateUserActivityInput = {
  userId: number;
  type: UserActivityType;
  description: string;
  target?: string | null;
  content?: string | null;
  metadata?: Record<string, any> | null;
};

export type FindUserActivitiesParams = {
  userId?: number;
  type?: UserActivityType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
};
