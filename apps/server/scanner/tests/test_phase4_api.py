import io

import pytest

from core.tests.factories import ProductFactory
from scanner.models import FaceScanRecord

pytestmark = pytest.mark.django_db


def test_analyze_returns_the_functional_contract_and_a_palette(api_client, monkeypatch):
    monkeypatch.setattr('scanner.views.analyze_face_images', lambda images, user=None: {
        'success': True, 'detected_skin_tone': 'Medium', 'confidence_score': 88,
        'lighting_quality': 'Good', 'brightness': 140.0, 'message': 'Medium depth, warm undertone.',
        'monk': 6, 'undertone': 'warm', 'ita': 30.0, 'hue': 55.0, 'agreement': 1.0,
        'selected_frame_debug': {}, 'total_frames_analyzed': 1, 'all_frame_results': [],
    })
    response = api_client.post('/api/scanner/analyze/', {'image': io.BytesIO(b'image')}, format='multipart')
    assert response.status_code == 200
    body = response.json()
    assert body['depth'] == 'Medium' and body['confidence'] == 88
    assert body['undertone'] == 'warm' and 'best' in body['palette'] and 'avoid' in body['palette']


def test_manual_tone_is_the_fallback_that_needs_no_camera(user):
    from rest_framework.test import APIClient
    client = APIClient(); client.force_authenticate(user=user)
    response = client.post('/api/scanner/manual/', {'depth': 'Dark', 'undertone': 'cool'}, format='json')
    assert response.status_code == 200
    assert {'best', 'avoid'} <= set(response.json()['palette'])
    record = FaceScanRecord.objects.get(user=user)
    assert record.detected_skin_tone == 'Dark' and record.lighting_quality == 'Manual'


def test_manual_tone_rejects_unknown_values(api_client):
    assert api_client.post('/api/scanner/manual/', {'depth': 'Blue', 'undertone': 'warm'}, format='json').status_code == 400
    assert api_client.post('/api/scanner/manual/', {'depth': 'Fair', 'undertone': 'purple'}, format='json').status_code == 400


def test_the_short_recommendation_and_look_aliases_work(api_client):
    product = ProductFactory(name='Alias Shirt', slot='top', stock_quantity=5, color_name='Navy Blue')
    ProductFactory(name='Alias Trouser', slot='bottom', stock_quantity=5, color_name='Black')

    recs = api_client.get('/api/recommendations/?depth=Medium&undertone=warm&gender=men')
    assert recs.status_code == 200 and 'items' in recs.json()

    look = api_client.get(f'/api/looks/?product={product.id}&depth=Medium&undertone=warm')
    assert look.status_code == 200
    assert look.json()['anchor']['id'] == product.id and isinstance(look.json()['slots'], list)
    assert api_client.get('/api/looks/').status_code == 400
