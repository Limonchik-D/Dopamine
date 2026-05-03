import type { User } from "../types/index.js";
import type { RegisterInput, LoginInput } from "../validators/schemas.js";
import { UserRepository } from "../repositories/userRepository.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signJwt } from "../utils/jwt.js";
import { slugify } from "../utils/helpers.js";

export class AuthService {
  private repo: UserRepository;

  constructor(
    private jwtSecret: string,
    private jwtExpiresIn: number,
    private adminEmails: string[] = []
  ) {
    this.repo = new UserRepository();
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private isAdminEmail(email: string) {
    return this.adminEmails.includes(this.normalizeEmail(email));
  }

  private async ensureAdminRole(user: User): Promise<User> {
    if (!this.isAdminEmail(user.email)) return user;
    if (user.role === "admin") return user;
    return this.repo.setRole(user.id, "admin");
  }

  private async issueToken(user: User): Promise<string> {
    return signJwt(
      { sub: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      this.jwtExpiresIn
    );
  }

  async register(input: RegisterInput): Promise<{ user: User; token: string }> {
    const [emailExists, usernameExists] = await Promise.all([
      this.repo.emailExists(input.email),
      this.repo.usernameExists(input.username),
    ]);

    if (emailExists) throw new Error("Validation: Email уже используется");
    if (usernameExists) throw new Error("Validation: Имя пользователя занято");

    const passwordHash = await hashPassword(input.password);
    const role = this.isAdminEmail(input.email) ? "admin" : "user";
    const created = await this.repo.create(input.email, input.username, passwordHash, role);
    const user = await this.ensureAdminRole(created);
    const token = await this.issueToken(user);

    return { user, token };
  }

  async login(input: LoginInput): Promise<{ user: User; token: string }> {
    const passwordHash = await this.repo.findPasswordHash(input.email);
    if (!passwordHash) throw new Error("Validation: Неверный email или пароль");

    const valid = await verifyPassword(input.password, passwordHash);
    if (!valid) throw new Error("Validation: Неверный email или пароль");

    const found = await this.repo.findByEmail(input.email);
    const user = found ? await this.ensureAdminRole(found) : null;
    if (!user) throw new Error("Not found");

    const token = await this.issueToken(user);

    return { user, token };
  }

  async loginWithGoogle(profile: { sub: string; email: string; name?: string | null }): Promise<{ user: User; token: string }> {
    const normalizedEmail = this.normalizeEmail(profile.email);

    let user = await this.repo.findByGoogleSub(profile.sub);

    if (!user) {
      const existingByEmail = await this.repo.findByEmail(normalizedEmail);
      if (existingByEmail) {
        await this.repo.linkGoogleSub(existingByEmail.id, profile.sub);
        user = await this.repo.findById(existingByEmail.id);
      }
    }

    if (!user) {
      const emailPrefix = normalizedEmail.split("@")[0] ?? "user";
      const preferred = slugify(profile.name?.trim() || emailPrefix) || "user";
      let username = preferred;
      let suffix = 1;

      while (await this.repo.usernameExists(username)) {
        suffix += 1;
        username = `${preferred}-${suffix}`;
      }

      const role = this.isAdminEmail(normalizedEmail) ? "admin" : "user";
      user = await this.repo.createOAuthUser(normalizedEmail, username, profile.sub, role);
    }

    user = await this.ensureAdminRole(user);
    const token = await this.issueToken(user);
    return { user, token };
  }

  async getMe(userId: number): Promise<User> {
    const user = await this.repo.findById(userId);
    if (!user) throw new Error("Not found");
    return user;
  }
}
