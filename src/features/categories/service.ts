import { asc } from "drizzle-orm";
import { createCrudService } from "../../handlers/crud";
import { categories } from "../../db/schema/categories";
import { slugify } from "../../libs/slug";
import type { CreateCategory, UpdateCategory } from "./model";

const crud = createCrudService(categories, { label: "Category", orderBy: asc(categories.order) });

export const listCategories = crud.list;
export const getCategory = crud.getById;
export const deleteCategory = crud.remove;

export const createCategory = (input: CreateCategory) =>
  crud.create({ ...input, slug: input.slug ?? slugify(input.name) });

export const updateCategory = (id: string, input: UpdateCategory) => crud.update(id, input);
