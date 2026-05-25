import test from 'ava';

import {
  CitationFootnoteFormatter,
  getVertexPublisherModelsUrl,
  readVertexModelListResponse,
} from '../../plugins/copilot/providers/utils';

test('CitationFootnoteFormatter should format sorted footnotes from citation events', t => {
  const formatter = new CitationFootnoteFormatter();

  formatter.consume({
    type: 'citation',
    index: 2,
    url: 'https://example.com/b',
  });
  formatter.consume({
    type: 'citation',
    index: 1,
    url: 'https://example.com/a',
  });

  t.is(
    formatter.end(),
    [
      '[^1]: {"type":"url","url":"https%3A%2F%2Fexample.com%2Fa"}',
      '[^2]: {"type":"url","url":"https%3A%2F%2Fexample.com%2Fb"}',
    ].join('\n')
  );
});

test('CitationFootnoteFormatter should overwrite duplicated index with latest url', t => {
  const formatter = new CitationFootnoteFormatter();

  formatter.consume({
    type: 'citation',
    index: 1,
    url: 'https://example.com/old',
  });
  formatter.consume({
    type: 'citation',
    index: 1,
    url: 'https://example.com/new',
  });

  t.is(
    formatter.end(),
    '[^1]: {"type":"url","url":"https%3A%2F%2Fexample.com%2Fnew"}'
  );
});

test('Vertex publisher model list > given project-scoped Vertex config > then uses publisher v1beta1 endpoint', t => {
  t.is(
    getVertexPublisherModelsUrl(
      {
        location: 'us-central1',
        project: 'affine-495114',
      },
      'google'
    ),
    'https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models'
  );
});

test('Vertex publisher model list > given custom baseURL > then preserves custom endpoint', t => {
  t.is(
    getVertexPublisherModelsUrl(
      {
        baseURL:
          'https://vertex-proxy.example.com/v1/projects/demo/locations/us-central1/publishers/google/',
        location: 'us-central1',
        project: 'affine-495114',
      },
      'google'
    ),
    'https://vertex-proxy.example.com/v1/projects/demo/locations/us-central1/publishers/google/models'
  );
});

test('Vertex publisher model list > given non-JSON response > then returns undefined', async t => {
  const result = await readVertexModelListResponse(
    new Response('<!DOCTYPE html>', {
      headers: { 'content-type': 'text/html' },
      status: 404,
    })
  );

  t.is(result, undefined);
});

test('Vertex publisher model list > given valid response > then returns publisher models', async t => {
  const result = await readVertexModelListResponse(
    Response.json({
      publisherModels: [
        {
          name: 'publishers/google/models/gemini-2.5-flash',
          versionId: 'default',
        },
      ],
    })
  );

  t.deepEqual(result, [
    {
      name: 'publishers/google/models/gemini-2.5-flash',
      versionId: 'default',
    },
  ]);
});
