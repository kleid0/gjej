// Store entity — represents a retailer that can be scraped for prices

export interface Store {
  id: string;
  name: string;
  url: string;
  logo: string;
  color: string;
  searchUrls: (query: string) => string[];
  selectors: {
    productLink: string[];
    price: string[];
    stock: string[];
    inStockText: string[];
    outOfStockText: string[];
  };
}
