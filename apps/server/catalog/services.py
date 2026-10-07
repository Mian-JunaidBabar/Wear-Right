def create_product(serializer):
    return serializer.save()
def update_product(serializer):
    return serializer.save()
def delete_product(product):
    product.delete()
