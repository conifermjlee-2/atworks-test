'use client';

import React from 'react';

interface CategoryFilterProps {
  currentCategory: string;
  onSelectCategory: (category: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'electronics', label: '전자제품' },
  { id: 'fashion', label: '패션' },
  { id: 'living', label: '인테리어/리빙' },
  { id: 'beauty', label: '뷰티' },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  currentCategory,
  onSelectCategory,
}) => {
  return (
    <div className="category-filter-container">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className={`category-pill ${currentCategory === cat.id ? 'active' : ''}`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
