import type { MobileRegisterInput } from '@expressmx/validations';
import type { DataResponse } from './common';

export type RegisterRequest = MobileRegisterInput;
export type RegisterResponse = DataResponse<{ id: string }>;
