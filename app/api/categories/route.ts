import { NextRequest, NextResponse } from 'next/server';
import { reloadDatabase, saveDb } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';
import { Category } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = reloadDatabase();
    
    // Sort by type, then name
    const sortedCategories = [...db.categories].sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) return typeCompare;
      return a.name.localeCompare(b.name);
    });
    
    return NextResponse.json(sortedCategories);
  } catch (error) {
    logger.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, color, parentId, isParent } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    const db = reloadDatabase();
    
    const newCategory: Category = {
      id: db.nextId.categories++,
      name,
      type,
      color: color || '#3b82f6',
    };

    if (parentId !== undefined) newCategory.parentId = parentId;
    if (isParent) newCategory.isParent = isParent;

    db.categories.push(newCategory);
    saveDb();

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    logger.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, type, color, rules, parentId, isParent } = body;

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const db = reloadDatabase();
    const categoryIndex = db.categories.findIndex(c => c.id === id);

    if (categoryIndex === -1) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const category = db.categories[categoryIndex];
    
    if (name !== undefined) category.name = name;
    if (type !== undefined) category.type = type;
    if (color !== undefined) category.color = color;
    if (rules !== undefined) category.rules = rules;
    if (parentId !== undefined) category.parentId = parentId;
    if (isParent !== undefined) category.isParent = isParent;

    saveDb();

    return NextResponse.json(category);
  } catch (error) {
    logger.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const db = reloadDatabase();
    const categoryIndex = db.categories.findIndex(c => c.id === id);

    if (categoryIndex === -1) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    db.categories.splice(categoryIndex, 1);
    saveDb();

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
