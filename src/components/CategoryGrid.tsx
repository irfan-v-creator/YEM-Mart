import React from 'react';
import { Category, Product } from '../types';
import { 
  Shirt, 
  Watch, 
  Headphones, 
  UtensilsCrossed, 
  BookOpen, 
  Smile, 
  Gift, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface CategoryGridProps {
  products: Product[];
  selectedCategory: Category | 'All';
  onSelectCategory: (category: Category | 'All') => void;
}

interface CategoryMeta {
  name: Category;
  icon: React.ReactNode;
  description: string;
  image: string;
}

const CATEGORY_META: CategoryMeta[] = [
  {
    name: 'Fashion',
    icon: <Shirt className="w-5 h-5" />,
    description: 'Pure linen, kurtis & everyday wear',
    image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Accessories',
    icon: <Watch className="w-5 h-5" />,
    description: 'Wallets, sunglasses & wearables',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Electronics',
    icon: <Headphones className="w-5 h-5" />,
    description: 'ANC earbuds, power banks & chargers',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Home & Kitchen',
    icon: <UtensilsCrossed className="w-5 h-5" />,
    description: 'Cast iron cookware & travel flasks',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Stationery',
    icon: <BookOpen className="w-5 h-5" />,
    description: 'Hardbound dot journals & brass pens',
    image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Kids',
    icon: <Smile className="w-5 h-5" />,
    description: 'Organic wooden toys & Montessori puzzles',
    image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Gifts',
    icon: <Gift className="w-5 h-5" />,
    description: 'Aranmula brass lamps & spice chests',
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=400&q=80',
  },
  {
    name: 'Others',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Aromatherapy sprays & daily essentials',
    image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
  },
];

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  products,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#C9A44C]">Explore Department</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#171717] tracking-tight">Shop by Category</h2>
        </div>
        <button
          onClick={() => onSelectCategory('All')}
          className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-[#C9A44C] flex items-center gap-1 transition-colors"
        >
          <span>View All Products</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {CATEGORY_META.map((cat) => {
          const count = products.filter(p => p.category === cat.name && p.status === 'published').length;
          const isSelected = selectedCategory === cat.name;

          return (
            <div
              key={cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className={`group cursor-pointer rounded-2xl p-3 flex flex-col items-center text-center transition-all border ${
                isSelected
                  ? 'bg-white border-[#C9A44C] ring-2 ring-[#C9A44C]/20 shadow-md'
                  : 'bg-white border-[#E7E5E0] hover:border-neutral-400 hover:shadow-sm'
              }`}
            >
              <div className="w-14 h-14 rounded-full overflow-hidden mb-2.5 relative bg-[#F7F6F2] flex items-center justify-center border border-neutral-100 group-hover:scale-105 transition-transform">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-[#171717]/20 group-hover:bg-[#171717]/10 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center text-white drop-shadow">
                  {cat.icon}
                </div>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-[#171717] group-hover:text-[#C9A44C] transition-colors leading-tight">
                {cat.name}
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {count} {count === 1 ? 'item' : 'items'}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
