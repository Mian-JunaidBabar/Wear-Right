import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from catalog.models import Category, Color, Product
from core.tests.factories import ProductFactory

pytestmark = pytest.mark.django_db


def image_upload(name='photo.png', colour=(200, 20, 30), content_type='image/png'):
    buffer = io.BytesIO()
    Image.new('RGB', (80, 80), colour).save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


def product_payload(**overrides):
    payload = {
        "name": "Phase Two Shirt", "category": "Men Shirt", "cultural_tag": "Casual",
        "compatible_skin_tone": "All", "price": "2500", "stock_quantity": 5,
    }
    payload.update(overrides)
    return payload


def test_the_product_list_is_paginated_and_keeps_the_legacy_keys(api_client):
    created = [ProductFactory(status='Active') for _ in range(15)]

    body = api_client.get('/api/products/').json()
    assert body['count'] == 15 and body['total_products'] == 15
    assert len(body['products']) == 12 and body['products'] == body['results']
    assert body['page'] == 1 and body['total_pages'] == 2 and body['next']

    page_two = api_client.get('/api/products/?page=2').json()
    assert len(page_two['products']) == 3 and page_two['previous']
    assert [p['id'] for p in page_two['products']] == [p.id for p in reversed(created[:3])]


def test_filters_cover_category_slot_gender_style_colour_price_stock_and_search(api_client):
    ProductFactory(name='Navy Formal Shirt', category='Men Shirt', slot='top', gender='men',
                   cultural_tag='Formal', style='formal', color_name='Navy Blue', price=3000, stock_quantity=4)
    ProductFactory(name='Red Casual Kurta', category='Women Kurta', slot='kurta', gender='women',
                   cultural_tag='Casual', style='casual', color_name='Bright Red', price=6000, stock_quantity=0)
    ProductFactory(name='Black Watch', category='Watches', slot='accessory', gender='unisex',
                   cultural_tag='Formal', style='formal', color_name='Black', price=900, stock_quantity=2)

    def names(query):
        return [p['name'] for p in api_client.get(f'/api/products/?{query}').json()['products']]

    assert names('category=Men%20Shirt') == ['Navy Formal Shirt']
    assert names('slot=accessory') == ['Black Watch']
    assert names('gender=women') == ['Red Casual Kurta']
    assert set(names('style=formal')) == {'Navy Formal Shirt', 'Black Watch'}
    assert names('color=Bright%20Red') == ['Red Casual Kurta']
    assert set(names('min_price=500&max_price=4000')) == {'Navy Formal Shirt', 'Black Watch'}
    assert set(names('in_stock=1')) == {'Navy Formal Shirt', 'Black Watch'}
    assert names('search=watch') == ['Black Watch']
    assert names('ordering=price') == ['Black Watch', 'Navy Formal Shirt', 'Red Casual Kurta']


def test_staff_can_manage_colours_but_shoppers_can_only_read(api_client, staff_client):
    assert api_client.post('/api/colors/', {'name': 'Wine', 'hex': '#800020'}, format='json').status_code == 401
    created = staff_client.post('/api/colors/', {'name': 'Wine', 'hex': '#800020'}, format='json')
    assert created.status_code == 201
    colour = Color.objects.get(name='Wine')
    assert colour.family == 'red'
    assert api_client.get('/api/colors/').json()['colors'][0]['hex'] == '#800020'
    assert staff_client.put(f'/api/colors/{colour.id}/', {'hex': '#000000'}, format='json').status_code == 200
    assert staff_client.delete(f'/api/colors/{colour.id}/').status_code == 200


def test_product_create_sets_slug_category_relation_style_sizes_and_colour(staff_client):
    colour = Color.objects.create(name='Navy Blue', hex='#000080', family='blue')
    response = staff_client.post('/api/products/', product_payload(
        category='Men Shirt', cultural_tag='Formal', primary_color=colour.id, sizes=['M', 'L'],
        description='A navy shirt.',
    ), format='json')
    assert response.status_code == 201
    row = Product.objects.get(id=response.json()['product']['id'])
    assert row.slug == 'phase-two-shirt'
    assert row.category_ref.name == 'Men Shirt' and row.style == 'formal'
    assert row.sizes == ['M', 'L'] and row.color_name == 'Navy Blue' and row.is_active is True
    assert response.json()['product']['category_slug'] == 'men-shirt'


def test_staff_can_upload_an_image_and_get_a_colour_suggestion(api_client, staff_client):
    response = staff_client.post('/api/products/', {**product_payload(name='Red Upload'), 'image': image_upload()}, format='multipart')
    assert response.status_code == 201
    suggestion = response.json()['color_suggestion']
    assert suggestion['name'] == 'Bright Red' and suggestion['family'] == 'red'
    assert suggestion['palette']

    direct = staff_client.post('/api/products/color-suggestion/', {'image': image_upload()}, format='multipart')
    assert direct.status_code == 200 and direct.json()['suggestion']['hex'].startswith('#')


def test_upload_validation_rejects_a_non_image_and_an_oversized_file(staff_client):
    bad = staff_client.post('/api/products/', {
        **product_payload(name='Bad Type'), 'image': SimpleUploadedFile('x.png', b'not really an image', content_type='image/png'),
    }, format='multipart')
    assert bad.status_code == 400 and 'errors' in bad.json()

    too_big = staff_client.post('/api/products/color-suggestion/', {
        'image': SimpleUploadedFile('big.jpg', b'x' * (5 * 1024 * 1024 + 1), content_type='image/jpeg'),
    }, format='multipart')
    assert too_big.status_code == 400 and '5 MB' in too_big.json()['message']


def test_inactive_products_are_hidden_from_shoppers_and_visible_to_staff(api_client, staff_client):
    ProductFactory(name='Switched Off', is_active=False)
    assert api_client.get('/api/products/').json()['count'] == 0
    assert staff_client.get('/api/products/').json()['count'] == 1

    product = ProductFactory(name='Toggle Me')
    response = staff_client.put(f'/api/products/{product.id}/', {'is_active': False}, format='json')
    assert response.status_code == 200
    assert api_client.get(f'/api/products/{product.id}/').status_code == 404


def test_category_slots_and_slugs_are_editable(staff_client):
    response = staff_client.post('/api/categories/', {
        'name': 'Women Lehenga', 'gender': 'women', 'slot': 'fullbody',
    }, format='json')
    assert response.status_code == 201
    row = Category.objects.get(name='Women Lehenga')
    assert row.slug == 'women-lehenga' and row.slot == 'fullbody'
    assert staff_client.put(f'/api/categories/{row.id}/', {'slot': 'bottom'}, format='json').json()['category']['slot'] == 'bottom'


def test_csv_import_still_maps_every_imported_record(tmp_path):
    # The real Kaggle folder is not committed; this fixture proves the import path and is documented as such.
    from django.core.management import call_command
    (tmp_path / 'styles.csv').write_text(
        "id,gender,masterCategory,subCategory,articleType,baseColour,season,year,usage,productDisplayName\n"
        "1,Men,Apparel,Topwear,Shirts,Navy Blue,Fall,2011,Formal,Navy Shirt\n", encoding='utf-8')
    (tmp_path / 'images').mkdir()
    Image.new('RGB', (40, 40), (10, 20, 120)).save(tmp_path / 'images' / '1.jpg')
    call_command('import_fashion_catalog', source=str(tmp_path), limit=1)
    row = Product.objects.get(external_id='1')
    assert row.category == 'Men Shirt' and row.style == 'formal' and row.gender == 'men'
