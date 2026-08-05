import { createClient } from "@/app/api/util/supabase/server";
import { cookies } from "next/headers";

//Get All Products
export async function getAllProduct(){
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    try {
        const { data, error } = await supabase.from("products").select("*");
        if (error) {
            throw error;
        }
        return data;
    } catch (error) {
        console.error("Error fetching products:", error);
        throw new Error("Failed to fetch products");
    }
}

//Get Product Item
export async function getProductItems(id:string) {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    try {
        const { data, error } = await supabase.from("products").select("*").eq("id", id);
        if (error) {
            throw error;
        }
        return data;
    } catch (error) {
        console.error("Error fetching products:", error);
        throw new Error("Failed to fetch products");
    }
}

//Update Product
export async function updateProduct(id: string, data: any) {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    try {
        const { data: updatedProduct, error } = await supabase
            .from("products")
            .update(data)
            .eq("id", id)
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        return updatedProduct;
    } catch (error) {
        console.error("Error updating product:", error);
        throw new Error("Failed to update product");
    }
}

//Delete Product
export async function deleteProduct(id: string) {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    try {
        const { data, error } = await supabase.from("products").delete().eq("id", id);
        if (error) {
            throw error;
        }
        return data;
    } catch (error) {
        console.error("Error deleting product:", error);
        throw new Error("Failed to delete product");
    }
}

//Add Product
export async function addProduct(data: any) {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    try {
        const { data: newProduct, error } = await supabase
            .from("products")
            .insert(data)
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        return newProduct;
    } catch (error) {
        console.error("Error adding product:", error);
        throw new Error("Failed to add product");
    }
}
